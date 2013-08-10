var g_LobbyIsConnecting = false;
var g_InitialUsername = "";
var g_InitialPassword = "";

function init()
{
	g_InitialUsername = g_ConfigDB.user["lobby.login"];
	g_InitialPassword = g_ConfigDB.user["lobby.password"];
}

function lobbyStop()
{
	getGUIObjectByName("connectFeedback").caption = "";
	getGUIObjectByName("registerFeedback").caption = "";

	if (g_LobbyIsConnecting == false)
		return;

	g_LobbyIsConnecting = false;
	Engine.StopXmppClient();
}

function lobbyStart()
{
	if (g_LobbyIsConnecting != false)
		return;

	var username = getGUIObjectByName("connectUsername").caption;
	var password = getGUIObjectByName("connectPassword").caption;
	var feedback = getGUIObjectByName("connectFeedback");

	if (!username || !password)
	{
		feedback.caption = "Username or password empty";
		return;
	}

	feedback.caption = "Connecting..";
	Engine.StartXmppClient(username, password, "arena", sanitisePlayerName(username));
	g_LobbyIsConnecting=true;
	Engine.ConnectXmppClient();
}

function lobbyStartRegister()
{
	if (g_LobbyIsConnecting != false)
		return;

	var account = getGUIObjectByName("connectUsername").caption;
	var password = getGUIObjectByName("connectPassword").caption;
	var passwordAgain = getGUIObjectByName("registerPasswordAgain").caption;
	var feedback = getGUIObjectByName("registerFeedback");

	if (!account || !password || !passwordAgain)
	{
		feedback.caption = "Login or password empty";
		return;
	}

	if (password != passwordAgain)
	{
		feedback.caption = "Password mismatch";
		getGUIObjectByName("connectPassword").caption = "";
		getGUIObjectByName("registerPasswordAgain").caption = "";
		return;
	}

	feedback.caption = "Registering...";
	Engine.StartRegisterXmppClient(account, password);
	g_LobbyIsConnecting = true;
	Engine.ConnectXmppClient();
}

function onTick()
{
	if (!g_LobbyIsConnecting)
		// The Xmpp Client has not been created
		return;

	// The XmppClient has been created, we are waiting
	// to be connected or to receive an error.

	//Wake up XmppClient
	Engine.RecvXmppClient();

	//Receive messages
	while (true)
	{
		var message = Engine.LobbyGuiPollMessage();
		if (!message)
			break;

		if (message.type == "muc" && message.level == "join")
		{
			// We are connected, switch to the lobby page
			Engine.PopGuiPage();
			var username = getGUIObjectByName("connectUsername").caption;
			var password = getGUIObjectByName("connectPassword").caption;
			Engine.SwitchGuiPage("page_lobby.xml", { name: sanitisePlayerName(username) } );

			// Store latest player name
			Engine.SaveMPConfig(sanitisePlayerName(username), Engine.GetDefaultMPServer());
			// Store latest username and password
			Engine.SetDefaultLobbyPlayerPair(username, password);

			return;
		}
		else if (message.type == "system" && message.text == "registered")
		{
			// Great, we are registered. Switch to the connection window.
			getGUIObjectByName("registerFeedback").caption = message.text;
			getGUIObjectByName("connectFeedback").caption = message.text;
			Engine.StopXmppClient();
			g_LobbyIsConnecting = false;
			getGUIObjectByName("pageRegister").hidden = true;
			getGUIObjectByName("pageConnect").hidden = false;
		}
		else if(message.type == "system" && (message.level == "error" || message.text == "disconnected"))
		{
			getGUIObjectByName("connectFeedback").caption = message.text;
			getGUIObjectByName("registerFeedback").caption = message.text;
			Engine.StopXmppClient();
			g_LobbyIsConnecting = false;
		}
	}
}

function sanitisePlayerName(name)
{
	// We delete the '[', ']' (GUI tags) and ',' (players names separator) characters
	// and limit the length to 20 characters
	return name.replace(/[\[\],]+/g,"").substr(0,20);
}
