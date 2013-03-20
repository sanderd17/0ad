var g_ChatMessages = [];
var g_Name = "unknown Bob";
var g_GameList = {};

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
	getGUIObjectByName("mapSizeFilter").selected = -1;
	getGUIObjectByName("playersNumberFilter").selected = -1;
	getGUIObjectByName("victoryConditionFilter").selected = -1;
	getGUIObjectByName("hideFullFilter").checked = false;

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
	//Store the game whole game list data so that we can access it later
	//to update the game info panel.
	g_GameList = gameList;

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
			list_name.push(toTitleCase(g.name));
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
	//gamesBox.list_ip = list_ip;
	gamesBox.list_mapName = list_mapName;
	gamesBox.list_mapSize = list_mapSize;
	gamesBox.list_victoryCondition = list_victoryCondition;
	gamesBox.list_nPlayers = list_nPlayers;
	gamesBox.list = list;
	gamesBox.list_data = list_data;

	if (gamesBox.selected >= gamesBox.list_name.length)
		gamesBox.selected = -1;
}

function updatePlayerList()
{
	var playersBox = getGUIObjectByName("playersBox")

	var playerList = Engine.GetPlayerList();
	var playerListNames = [ player.name for each (player in playerList) ];

	playersBox.list = playerListNames;
	if (playersBox.selected >= playersBox.list.length)
		playersBox.selected = -1;
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

	//Get the selected map's name
	var gamesBox = getGUIObjectByName("gamesBox");
	var g = gamesBox.list_data[selected];
	var name = g_GameList[g].mapName;
	getGUIObjectByName("sgMapName").caption = toTitleCase(name);

	var mapData = null;

	//Search the selectep map in the scenarios
	var mapFiles = getXMLFileList("maps/scenarios/");
	for (var i = 0; i < mapFiles.length; ++i)
	{
		var file = mapFiles[i];
		if(name == file)
		{
			mapData = Engine.LoadMapSettings("maps/scenarios/"+file);
			break;
		}
	}

	//Search the selectep map in the scenarios
	if(!mapData)
	{
		var mapFiles = getJSONFileList("maps/random/");
		for (var i = 0; i < mapFiles.length; ++i)
		{
			var file = mapFiles[i];
			if(name == file)
			{
				mapData = parseJSONData("maps/random/"+file+".json");
			}
		}
	}

	if(!mapData)
	{
		log("Map '"+ name +"'  not found");
	}

	// Load the description from the map file, if there is one, and display it
	var mapSettings = (mapData && mapData.settings ? deepcopy(mapData.settings) : {});
	var description = mapSettings.Description || "Sorry, no description available.";
	getGUIObjectByName("sgMapDescription").caption = description;

	// Set the number of players, the map size and the victory condition text boxes
	getGUIObjectByName("sgNbPlayers").caption = g_GameList[g].nbp + "/" + g_GameList[g].tnbp;
	getGUIObjectByName("sgMapSize").caption = tilesToMapSize(g_GameList[g].mapSize);
	getGUIObjectByName("sgVictoryCondition").caption = toTitleCase(g_GameList[g].victoryCondition);

	// Set the map preview
	var mapPreview = mapSettings.Preview || "nopreview.pmng";
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
		
		// Check if it looks like an ip address
		if (sip.split('.').length != 4) 
		{
			addChatMessage({ "from": "system", "text": "This game does not have a valid address", "color": "150 0 0" });
			return
		}

		// Set player presence
		Engine.LobbySetPlayerPresence("playing");

		// Open Multiplayer connection window with join option.
		Engine.PushGuiPage("page_gamesetup_mp.xml", { multiplayerGameType: "join", source: "lobby", name: sname, ip: sip });	
	}
}

////////////////////////////////////////////////////////////////////////////////////////////////
// Utils
////////////////////////////////////////////////////////////////////////////////////////////////
function tilesToMapSize(tiles)
{
	var s = g_mapSizes.tiles.indexOf(Number(tiles));
	return s != -1 ? g_mapSizes.names[s].split(" ")[0] : "?";
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
	//Wake up XmppClient
	Engine.RecvXmppClient();

	//Receive messages
	while (true)
	{
		var message = Engine.LobbyGuiPollMessage();
		if (!message)
			break;
		switch (message.type)
		{
			case "mucmessage":
				addChatMessage({ "from": message.from, "text": message.text , "color": "50 50 50"});
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
							// Disable the 'host' and 'refresh' buttons
							getGUIObjectByName("refreshButton").enabled = false;
							getGUIObjectByName("hostButton").enabled = false;
						}
						else if (message.text == "connected")
						{
							getGUIObjectByName("refreshButton").enabled = true
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
								var time = twoDigits(t.getUTCHours())+":"+twoDigits(t.getUTCMinutes())+":"+twoDigits(t.getUTCSeconds());
								getGUIObjectByName("updateStatusText").caption = "Updated at " + time;
								break;
							case "playerlist updated":
								updatePlayerList();
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
		Engine.LobbySendMessage(text);
		input.caption = "";
	}
}

function handleMessage(message)
{

}

function pp(txt)
{
	addChatMessage({"from":"debug", "color":"200 0 0", "text":txt});
}

function addChatMessage(msg)
{
	var from = escapeText(msg.from);
	var text = escapeText(msg.text);
	var color = msg.color;

	var formatted = '[font="serif-bold-13"]<[color="'+ color +'"]' + from + '[/color]>[/font] ' + text;
	g_ChatMessages.push(formatted);
	getGUIObjectByName("chatText").caption = g_ChatMessages.join("\n");
}
