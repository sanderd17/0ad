#ifndef GAMEITEMDATA_H
#define GAMEITEMDATA_H

#include <string>

#define ITEMS \
  ITEM(name)      \
  ITEM(ip)        \
  ITEM(nbp)       \
  ITEM(tnbp)      \
  ITEM(mapName)   \
  ITEM(mapSize)   \
  ITEM(victoryCondition)

class GameItemData
{
  friend class XmppClient;
  friend class GameListQuery;
public:
  GameItemData(std::string name= "", std::string ip = "")
  : m_name(name), m_ip(ip)
  {
  }

  virtual ~GameItemData() {}

  gloox::Tag* tag() const
  {
    gloox::Tag* i = new gloox::Tag( "game" );

#define ITEM(param)\
    i->addAttribute( #param, m_##param );
    ITEMS
#undef ITEM

    return i;
  }

protected:
#define ITEM(param)\
  std::string m_##param ;
  ITEMS
#undef ITEM
};

#endif
