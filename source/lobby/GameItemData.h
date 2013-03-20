#ifndef GAMEITEMDATA_H
#define GAMEITEMDATA_H

#include <string>

#define ITEMS \
  ITEM(name)      \
  ITEM(ip)        \
  ITEM(state)     \
  ITEM(nbp)       \
  ITEM(tnbp)      \
  ITEM(players)   \
  ITEM(mapName)   \
  ITEM(mapSize)   \
  ITEM(victoryCondition)

class GameItemData
{
  friend class XmppClient;
  friend class GameListQuery;
public:
  GameItemData() {}

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
