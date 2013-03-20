#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
    XpartaMuPP by :
	Badmadblacksad
	..
    For : 0ad
    License : GPL
"""

import sys
import logging
import time
from optparse import OptionParser

import sleekxmpp
from sleekxmpp.stanza import Iq
from sleekxmpp.stanza import *
from sleekxmpp.xmlstream import ElementBase, register_stanza_plugin, ET
from sleekxmpp.xmlstream.handler import Callback
from sleekxmpp.xmlstream.matcher import StanzaPath

from xml.dom.minidom import Document

## Configuration ##
configDEMOModOn = False 
## !Configuration ##

class BasicGameList(ElementBase):
  name = 'query'
  namespace = 'jabber:iq:gamelist'
  interfaces = set(('game', 'command'))
  sub_interfaces = interfaces
  plugin_attrib = 'gamelist'

  def addGame(self, name, ip, mapName, mapSize, victoryCondition, nbp, tnbp):
    itemXml = ET.Element("game", {"name":name, "ip":ip, "nbp":nbp, "tnbp":tnbp, "mapName":mapName, "mapSize":mapSize, "victoryCondition":victoryCondition})
    self.xml.append(itemXml)

  def getGame(self):
    game = self.xml.find('{%s}game' % self.namespace)
    return game.get("name"), game.get("ip"), game.get("mapName"), game.get("mapSize"), game.get("victoryCondition"), game.get("nbp"), game.get("tnbp")   

  def getCommand(self):
    command = self.xml.find('{%s}command' % self.namespace)
    return command

class XpartaMuPP(sleekxmpp.ClientXMPP):
  """
  A simple game list provider
  """

  def __init__(self, sjid, password, room, nick):
    sleekxmpp.ClientXMPP.__init__(self, sjid, password)
    self.sjid = sjid
    self.room = room
    self.nick = nick

    # Game management
    self.m_gameList = {}
    
    #DEMO
    if configDEMOModOn:
      self.addGame("666.666.666.666", "Unplayable map", "666.666.666.666", "Serengeti", "128", "gold rush", "4", "4")
      self.addGame("666.666.666.667", "Unreachale liberty", "666.666.666.667", "oasis", "256", "conquest", "2", "4")
      #for i in range(50):
      #  self.addGame("666.666.666."+str(i), "X"+str(i), "666.666.666."+str(i), "Oasis", "large", "conquest", "1", "4")   

    register_stanza_plugin(Iq, BasicGameList)
    self.register_handler(Callback('Iq Gamelist',
                                       StanzaPath('iq/gamelist'),
                                       self.iqhandler,
                                       instream=True))

    self.add_event_handler("session_start", self.start)
    self.add_event_handler("message", self.message)
    self.add_event_handler("muc::%s::got_online" % self.room, self.muc_online)
    self.add_event_handler("muc::%s::got_offline" % self.room, self.muc_offline)

  def start(self, event):
    """
    Process the session_start event
    """
    self.plugin['xep_0045'].joinMUC(self.room, self.nick)

    self.send_presence()
    self.get_roster()
    logging.info("xpartamupp started")

    #DEMO
    self.DEMOrequestGameList()
    #self.DEMOregisterGame()

  def message(self, msg):
    """
    Process incoming message stanzas
    """
    if msg['type'] == 'chat':
      msg.reply("Thanks for sending\n%(body)s" % msg).send()
      logging.comm("receive message"+msg['body'])

  def muc_online(self, presence):
    """
    Process presence stanza from a chat room. 
    """
    if presence['muc']['nick'] != self.nick:
      self.send_message(mto=presence['from'], mbody="Hello %s, welcome in the 0ad alpha chatroom. Polishes your weapons and get ready to fight!" %(presence['muc']['nick']), mtype='')

  def muc_offline(self, presence):
    """
    Process presence stanza from a chat room. 
    """
    if presence['muc']['nick'] != self.nick:
      self.removeGame(presence['muc']['jid'].bare)

  def iqhandler(self, iq):
    """
    Handle the custom <gamelist> stanza
    TODO: This method should be very robust because
    we could receive anything
    """
    if iq['type'] == 'error':
      logging.error('iqhandler error' + iq['error']['condition'])
      #self.disconnect()
    elif iq['type'] == 'get':
      """
      Request a gamelist
      """
      self.sendGameList(iq['from'])
    elif iq['type'] == 'result':
      """
      Iq successfully received
      """
      pass
    elif iq['type'] == 'set':
      """
      Register-update / unregister a game
      """
      command = iq['gamelist']['command'].text
      if command == 'register':
        try:
          name, ip, mapName, mapSize, victoryCondition, nbp, tnbp = iq['gamelist']['game']
          logging.debug("ip " + ip)
          self.addGame(iq['from'].bare,name,ip,mapName,mapSize,victoryCondition,nbp,tnbp)
        except:
          logging.error("Failed to process game data")
      elif command == 'unregister':
        self.removeGame(iq['from'].bare)

  def sendGameList(self, to):
    """
    Send a massive stanza with the whole game list
    """
    stz = BasicGameList()
    for k in self.m_gameList:
      g = self.m_gameList[k]
      stz.addGame(g['name'], g['ip'], g['mapName'], g['mapSize'], g['victoryCondition'], g['nbp'], g['tnbp'])
    iq = self.Iq()
    iq['type'] = 'result'
    iq['to'] = to
    iq.setPayload(stz)
    try:
      iq.send()
    except:
      logging.error("Failed to send game list")

  def DEMOrequestGameList(self):
    """
    Test function
    """
    iq = self.Iq()
    iq['type'] = 'get'
    iq['gamelist']['field'] = 'x'
    iq['to'] = self.boundjid.full
    iq.send(now=True, block=False)
    return True

  def DEMOregisterGame(self):
    """
    Test function
    """
    stz = BasicGameList()
    stz.addGame("DEMOregister","DEMOip","DEMOmap","","","","")
    stz['command'] = 'register'
    iq = self.Iq()
    iq['type'] = 'set'
    iq['to'] = self.boundjid.full
    iq.setPayload(stz)
    iq.send(now=True, block=False)
    return True

  # Game management

  def addGame(self, sid, name, ip, mapName, mapSize, victoryCondition, nbp, tnbp):
    game = { 'name':name, 'ip':ip, 'nbp':nbp, 'tnbp':tnbp, 'mapName':mapName, 'mapSize':mapSize, 'victoryCondition':victoryCondition } 
    self.m_gameList[sid] = game

  def removeGame(self, sid):
    if sid in self.m_gameList:
      del self.m_gameList[sid]

if __name__ == '__main__':
  # Setup the command line arguments.
  optp = OptionParser()

  # Output verbosity options.
  optp.add_option('-q', '--quiet', help='set logging to ERROR',
                  action='store_const', dest='loglevel',
                  const=logging.ERROR, default=logging.INFO)
  optp.add_option('-d', '--debug', help='set logging to DEBUG',
                  action='store_const', dest='loglevel',
                  const=logging.DEBUG, default=logging.INFO)
  optp.add_option('-v', '--verbose', help='set logging to COMM',
                  action='store_const', dest='loglevel',
                  const=5, default=logging.INFO)

  # XpartaMuPP configuration options
  optp.add_option('-m', '--domain', help='set xpartamupp domain',
                  action='store', dest='xdomain',
                  default="localhost")
  optp.add_option('-l', '--login', help='set xpartamupp login',
                  action='store', dest='xlogin',
                  default="xpartamupp")
  optp.add_option('-p', '--password', help='set xpartamupp password',
                  action='store', dest='xpassword',
                  default="XXXXXX")
  optp.add_option('-n', '--nickname', help='set xpartamupp nickname',
                  action='store', dest='xnickname',
                  default="XpartaMuCC")
  optp.add_option('-D', '--demo', help='set xpartamupp in DEMO mode (add a few fake games)',
                  action='store_true', dest='xdemomode',
                  default=False)

  opts, args = optp.parse_args()

  # Set DEMO mode
  configDEMOModOn = opts.xdemomode

  # Setup logging.
  logging.basicConfig(level=opts.loglevel,
                      format='%(levelname)-8s %(message)s')

  # XpartaMuPP
  xmpp = XpartaMuPP(opts.xlogin+'@'+opts.xdomain+'/CC', opts.xpassword, 'arena@conference.'+opts.xdomain, opts.xnickname)
  xmpp.register_plugin('xep_0030') # Service Discovery
  xmpp.register_plugin('xep_0004') # Data Forms
  xmpp.register_plugin('xep_0045') # Multi-User Chat	# used
  xmpp.register_plugin('xep_0060') # PubSub
  xmpp.register_plugin('xep_0199') # XMPP Ping

  if xmpp.connect():
    xmpp.process(threaded=False)
  else:
    logging.error("Unable to connect")

