var g_ChatMessages = [];
var g_Name = "unknown Bob";
var g_GameList = {};
var g_specialKey = Math.random();
var g_spamMonitor = {};
var g_spammers = {};
var g_IRCConfig = false;
var g_timestamp = g_ConfigDB.user["lobby.chattimestamp"] == "true";

////////////////////////////////////////////////////////////////////////////////////////////////
var g_mapSizes = {};

function init(attribs)
{
	if (attribs.name) g_Name = attribs.name;
	else error("No name");

	g_mapSizes = initMapSizes();
	g_mapSizes.names.push("Any");
	g_mapSizes.tiles.push("");

	var mapSizeFilter = getGUIObjectByName("mapSizeFilter");
	mapSizeFilter.list = g_mapSizes.names;
	mapSizeFilter.list_data = g_mapSizes.tiles;

	var playersNumberFilter = getGUIObjectByName("playersNumberFilter");
	playersNumberFilter.list = [2,3,4,5,6,7,8,"Any"];
	playersNumberFilter.list_data = [2,3,4,5,6,7,8,""];

	var victoryConditionFilter = getGUIObjectByName("victoryConditionFilter");
	victoryConditionFilter.list = ["Conquest","Any"];
	victoryConditionFilter.list_data = ["conquest",""];

	Engine.LobbySetPlayerPresence("available");
	Engine.SendGetGameList();

	resetFilters();
	var spamMonitorTimer = setTimeout(clearSpamMonitor, 5000);
	var spammerTimer = setTimeout(clearSpammers, 30000);
}

////////////////////////////////////////////////////////////////////////////////////////////////
// Xmpp client connection management
////////////////////////////////////////////////////////////////////////////////////////////////


function lobbyStop()
{
	Engine.StopXmppClient();
}

function lobbyConnect()
{
	Engine.ConnectXmppClient();
}

function lobbyDisconnect()
{
	Engine.DisconnectXmppClient();
}

////////////////////////////////////////////////////////////////////////////////////////////////
// Server requests functions
////////////////////////////////////////////////////////////////////////////////////////////////

function lobbyRefreshGameList()
{
	Engine.SendGetGameList();
}

////////////////////////////////////////////////////////////////////////////////////////////////
// Update functions
////////////////////////////////////////////////////////////////////////////////////////////////

function resetFilters()
{
	// Reset states of gui objects
	getGUIObjectByName("mapSizeFilter").selected = getGUIObjectByName("mapSizeFilter").list.length - 1;
	getGUIObjectByName("playersNumberFilter").selected = getGUIObjectByName("playersNumberFilter").list.length - 1;
	getGUIObjectByName("victoryConditionFilter").selected = getGUIObjectByName("victoryConditionFilter").list.length - 1;
	getGUIObjectByName("hideFullFilter").checked = true;

	// Update the list of games
	updateGameList();

	// Update info box about the game currently selected
	selectGame(getGUIObjectByName("gamesBox").selected);
}

function applyFilters()
{
	// Update the list of games
	updateGameList();

	// Update info box about the game currently selected
	selectGame(getGUIObjectByName("gamesBox").selected);
}

function displayGame(g, mapSizeFilter, playersNumberFilter, victoryConditionFilter, hideFullFilter)
{
	if(mapSizeFilter != "" && g.mapSize != mapSizeFilter) return false;
	if(playersNumberFilter != "" && g.tnbp != playersNumberFilter) return false;
	if(victoryConditionFilter != "" && g.victoryCondition != victoryConditionFilter) return false;
	if(hideFullFilter && g.tnbp == g.nbp) return false;

	return true;
}

function updateGameList()
{
	var gamesBox = getGUIObjectByName("gamesBox");
	var gameList = Engine.GetGameList();
	// Store the game whole game list data so that we can access it later
	// to update the game info panel.
	g_GameList = gameList;

	// Sort the list of games to that games 'waiting' are displayed at the top
	g_GameList.sort(function (a,b) {
		return a.state == 'waiting' ? -1 : b.state == 'waiting' ? +1 : 0;

	});

	var list_name = [];
	var list_ip = [];
	var list_mapName = [];
	var list_mapSize = [];
	var list_victoryCondition = [];
	var list_nPlayers = [];
	var list = [];
	var list_data = [];

	var mapSizeFilterDD = getGUIObjectByName("mapSizeFilter");
	var playersNumberFilterDD = getGUIObjectByName("playersNumberFilter");
	var victoryConditionFilterDD = getGUIObjectByName("victoryConditionFilter");
	var hideFullFilterCB = getGUIObjectByName("hideFullFilter");

	// Get filter values
	mapSizeFilter = mapSizeFilterDD.selected >= 0 ? mapSizeFilterDD.list_data[mapSizeFilterDD.selected] : "";
	playersNumberFilter = playersNumberFilterDD.selected >=0 ? playersNumberFilterDD.list_data[playersNumberFilterDD.selected] : "";
	victoryConditionFilter = victoryConditionFilterDD.selected >= 0 ? victoryConditionFilterDD.list_data[victoryConditionFilterDD.selected] : "";
	hideFullFilter = hideFullFilterCB.checked ? true : false;

	var c = 0;
	for each (g in gameList)
	{
		if(displayGame(g, mapSizeFilter, playersNumberFilter, victoryConditionFilter, hideFullFilter))
		{
			// Highlight games 'waiting' for this player, otherwise display as green
			var name = (g.state != 'waiting') ? '[color="0 125 0"]' + g.name + '[/color]' : '[color="orange"]' + toTitleCase(g.name) + '[/color]';
			list_name.push(name);
			list_ip.push(g.ip);
			list_mapName.push(toTitleCase(g.mapName));
			list_mapSize.push(tilesToMapSize(g.mapSize));
			list_victoryCondition.push(toTitleCase(g.victoryCondition));
			list_nPlayers.push(g.nbp + "/" +g.tnbp);
			list.push(g.name);
			list_data.push(c);
		}
		c++;
	}

	gamesBox.list_name = list_name;
	// gamesBox.list_ip = list_ip;
	gamesBox.list_mapName = list_mapName;
	gamesBox.list_mapSize = list_mapSize;
	gamesBox.list_victoryCondition = list_victoryCondition;
	gamesBox.list_nPlayers = list_nPlayers;
	gamesBox.list = list;
	gamesBox.list_data = list_data;

	if (gamesBox.selected >= gamesBox.list_name.length)
		gamesBox.selected = -1;

	// If game selected, update info box about the game.
	if(getGUIObjectByName("gamesBox").selected != -1)
		selectGame(getGUIObjectByName("gamesBox").selected)
}

// TODO: Handle all of that in playerChanged (possibly rename to playerPresenceChanged)?
function updatePlayerList()
{
	var nickname = Engine.GetDefaultPlayerName();
	var playerList = Engine.GetPlayerList();

	list_name = [];
	list_status = [];

	for each (p in playerList)
	{
		// Set colors based on player status
		var color_close = '[/color]'; 
		switch (p.presence)
		{
		case "playing":
			var color = '[color="125 0 0"]';
			var status = color + "Busy" + color_close;
			break;
		case "away":
			var color = '[color="0 0 125"]';
			var status = color + "Away" + color_close;
			break;
		case "available":
			var color = '[color="0 125 0"]';
			var status = color + "Online" + color_close;
			break;
		default:
			warn("Unknown presence '"+p.presence+"'");
			break;
		}

		// Highlight the local player's nickname
		if (p.name == nickname)
			color = '[color="orange"]';

		var name = color + p.name + color_close;

		// Push this player's name and status onto the list
		list_name.push(name);
		list_status.push(status);
	}

	var playersBox = getGUIObjectByName("playersBox")
	playersBox.list_name = list_name;
	playersBox.list_status = list_status;
	playersBox.list = list_name;
	if (playersBox.selected >= playersBox.list.length)
		playersBox.selected = -1;
}

// The following function notifies players when someone quits or joins the lobby.
function playerChanged(playerNick, joined)
{
	if (joined)
		addChatMessage({ "text":"/special " + playerNick + " has joined.", "key":g_specialKey});
	else
		addChatMessage({ "text":"/special " + playerNick + " has left.", "key":g_specialKey});
}

function selectGame(selected)
{
	if(selected == -1)
	{
		// Hide the game info panel if not game is selected
		getGUIObjectByName("gameInfo").hidden = true;
		getGUIObjectByName("gameInfoEmpty").hidden = false;
		return;
	}

	// Show the game info panel if a game is selected
	getGUIObjectByName("gameInfo").hidden = false;
	getGUIObjectByName("gameInfoEmpty").hidden = true;

	// Get the selected map's name
	var gamesBox = getGUIObjectByName("gamesBox");
	var g = gamesBox.list_data[selected];
	var name = g_GameList[g].mapName;
	getGUIObjectByName("sgMapName").caption = toTitleCase(name);

	var mapData = null;

	// Search the selected map in the scenarios
	var mapFiles = getXMLFileList("maps/scenarios/");
	for (var i = 0; i < mapFiles.length; ++i)
	{
		// TODO: Use VFS function to check if the file is present (also see below)
		var file = mapFiles[i];
		if(name == file)
		{
			mapData = Engine.LoadMapSettings("maps/scenarios/"+file);
			break;
		}
	}

	// Search for the selected map in the random maps
	if(!mapData)
	{
		// TODO: Why not check if we have the file and try to load it? (There surely is a VFS function exposed to allow us to check that)
		var mapFiles = getJSONFileList("maps/random/");
		for (var i = 0; i < mapFiles.length; ++i)
		{
			var file = mapFiles[i];
			if(name == file)
			{
				mapData = parseJSONData("maps/random/"+file+".json");
				break;
			}
		}
	}

	if(!mapData)
		log("Map '"+ name +"'  not found");

	// Load the description from the map file, if there is one, and display it
	var mapSettings = (mapData && mapData.settings ? deepcopy(mapData.settings) : {});
	var description = mapSettings.Description || "Sorry, no description available.";
	getGUIObjectByName("sgMapDescription").caption = description;

	// Set the number of players, the map size and the victory condition text boxes
	getGUIObjectByName("sgNbPlayers").caption = g_GameList[g].nbp + "/" + g_GameList[g].tnbp;
	getGUIObjectByName("sgPlayersNames").caption = g_GameList[g].players;
	getGUIObjectByName("sgMapSize").caption = tilesToMapSize(g_GameList[g].mapSize);
	getGUIObjectByName("sgVictoryCondition").caption = toTitleCase(g_GameList[g].victoryCondition);

	// Set the map preview
	var mapPreview = mapSettings.Preview || "nopreview.png";
	getGUIObjectByName("sgMapPreview").sprite = "cropped:(0.7812,0.5859)session/icons/mappreview/" + mapPreview;

}

function joinSelectedGame()
{
	var gamesBox = getGUIObjectByName("gamesBox");
	if (gamesBox.selected >= 0)
	{
		var g = gamesBox.list_data[gamesBox.selected];
		var sname = g_Name;
		var sip = g_GameList[g].ip;

		// TODO: What about valid host names?
		// Check if it looks like an ip address
		if (sip.split('.').length != 4) 
		{
			addChatMessage({ "from": "system", "text": "This game does not have a valid address", "color": "255 0 0" });
			return;
		}

		// Open Multiplayer connection window with join option.
		Engine.PushGuiPage("page_gamesetup_mp.xml", { multiplayerGameType: "join", name: sname, ip: sip });	
	}
}

////////////////////////////////////////////////////////////////////////////////////////////////
// Utils
////////////////////////////////////////////////////////////////////////////////////////////////
function tilesToMapSize(tiles)
{
	var s = g_mapSizes.tiles.indexOf(Number(tiles));
	if (s == 0 || s == -1)
		return "-";
	return g_mapSizes.names[s].split(" ")[0];
}

function twoDigits(n)
{
	return n < 10 ? "0" + n : n;
}

////////////////////////////////////////////////////////////////////////////////////////////////
// GUI event handlers
////////////////////////////////////////////////////////////////////////////////////////////////

function onTick()
{
	// Wake up XmppClient
	Engine.RecvXmppClient();

	updateTimers();

	// Receive messages
	while (true)
	{
		var message = Engine.LobbyGuiPollMessage();
		if (!message)
			break;
		switch (message.type)
		{
			case "mucmessage":
				addChatMessage({ "from": message.from, "text": message.text , "color": "250 250 250"});
				break;
			case "system":
				switch (message.level)
				{
					case "standard":
						addChatMessage({ "from": "system", "text": message.text, "color": "0 150 0" });
						if (message.text == "disconnected")
						{
							// Clear the list of games and the list of players
							updateGameList();
							updatePlayerList();
							// Disable the 'host' button
							getGUIObjectByName("hostButton").enabled = false;
						}
						else if (message.text == "connected")
						{
							getGUIObjectByName("hostButton").enabled = true;
						}
						break;
					case "error":
						addChatMessage({ "from": "system", "text": message.text, "color": "150 0 0" });
						break;
					case "internal":
						switch (message.text)
						{
							case "gamelist updated":
								updateGameList();
								var t = new Date(Date.now());
								var time = t.getHours() % 12 + ":" + twoDigits(t.getMinutes()) + ":" + twoDigits(t.getSeconds());
								getGUIObjectByName("updateStatusText").caption = "Updated at " + time;
								break;
							// Why not move these two to some message.type of "mucplayer"?
							// That could also handle stuff like nickchanges and that
							case "playerlist updated":
								updatePlayerList();
								break;
							case "playerchange":
								playerChanged(message.data.substring(1), message.data.substring(0, 1) === "j" ? true : false)
								break;
						}
						break
				}
				break;
			default:
				error("Unrecognised message type "+message.type);
		}
	}
}

/* Messages */
function submitChatInput()
{
	var input = getGUIObjectByName("chatInput");
	var text = input.caption;
	if (text.length)
	{
		if (!handleSpecialCommand(text))
			Engine.LobbySendMessage(text);
		input.caption = "";
	}
}

function handleSpecialCommand(text)
{
	if (text[0] != '/')
		return false;

	var [cmd, msg] = ircSplit(text);

	switch (cmd)
	{
	case "away":
		// TODO: Should we handle away messages?
		Engine.LobbySetPlayerPresence("away");
		break;
	case "back":
		Engine.LobbySetPlayerPresence("available");
		break;
	case "kick": // TODO
		warn("/kick not yet implemented");
		break;
	case "ban": // TODO
		warn("/ban not yet implemented");
		break;
	default:
		return false;
	}
	return true;
}

function addChatMessage(msg)
{
	var from = escapeText(msg.from);
	var text = escapeText(msg.text);
	var color = msg.color;

	// Run spam test
	if (updateSpamandDetect(text, from))
		return;

	// Format Text
	var formatted = ircFormat(text, from, color, msg.key);

	// If there is text, add it to the chat box.
	if (formatted)
	{
		g_ChatMessages.push(formatted);
		getGUIObjectByName("chatText").caption = g_ChatMessages.join("\n");
	}
}

function ircSplit(string)
{
	var idx = string.indexOf(' ');
	if (idx != -1)
		return [string.substr(1,idx-1), string.substr(idx+1)];
	return [string.substr(1)];
}

// The following formats text in an IRC-like way
function ircFormat(text, from, color, key)
{
	time = new Date(Date.now());
	function warnUnsupportedCommand(command, from) // Function to warn only local player
	{
		if (from === Engine.GetDefaultPlayerName())
			addChatMessage({ "from": "system", "text": "We're sorry, the '" + command + "' command is not supported.", "color": "255 0 0" });
		return;
	}

	// Build time header if enabled
	if (g_timestamp)
		formatted = '[font="serif-bold-13"]\x5B' + twoDigits(time.getHours() % 12) + ":" + twoDigits(time.getMinutes()) + '\x5D[/font] '
	else
		formatted = "";

	// Handle commands
	if (text[0] == '/')
	{
		var [command, message] = ircSplit(text);
		switch (command)
		{
			case "me":
				return formatted + '[font="serif-bold-13"]* [color="' + color + '"]' + from + '[/color][/font] ' + message;
			case "say":
				return formatted + '[font="serif-bold-13"]<[color="' + color + '"]' + from + '[/color]>[/font] ' + message;
			case "special":
				if (key === g_specialKey)
					return formatted + '[font="serif-bold-13"] == ' + message + '[/font]';
				break;
			default:
				return warnUnsupportedCommand(command, from)
		}
	}
	return formatted + '[font="serif-bold-13"]<[color="' + color + '"]' + from + '[/color]>[/font] ' + text;
}

// The following function tracks message stats and returns true if the input text is spam.
function updateSpamandDetect(text, from)
{
	// Check for blank lines.
	if (text == " ")
		return true;
	// Update the spam monitor.
	if (g_spamMonitor[from])
		g_spamMonitor[from]++;
	else
		g_spamMonitor[from] = 1;
	if (g_spamMonitor[from] > 5)
		g_spammers[from] = true
	// Block spammers and notify the player if they are blocked.
	if(from in g_spammers)
	{
		if (from == Engine.GetDefaultPlayerName())
		{
			addChatMessage({ "from": "system", "text": "Please do not spam. You have been blocked for thirty seconds.", "color": "255 0 0" });
		}
		return true;
	}
	// Return false if everything is clear.
	return false;
}

// Timers to clear spammers after some time.
function clearSpamMonitor()
{
	g_spamMonitor = {};
	spamTimer = setTimeout(clearSpamMonitor, 5000);
}

function clearSpammers()
{
	g_spammers = {};
	spammerTimer = setTimeout(clearSpammers, 30000);
}
