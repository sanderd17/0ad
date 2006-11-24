#ifndef SHAREDTYPES_H__
#define SHAREDTYPES_H__

#include "Shareable.h"

class wxPoint;
class CVector3D;

namespace AtlasMessage
{

// Represents a position in the game world, with an interface usable from the
// UI (which usually knows only about screen space). Typically constructed
// by the UI, then passed to the game which uses GetWorldSpace.

struct Position
{
	Position() : type(0) { type0.x = type0.y = type0.z = 0.f;  }

	// Constructs a position with specified world-space coordinates
	Position(float x, float y, float z) : type(0) { type0.x = x; type0.y = y; type0.z = z; }
	
	// Constructs a position on the terrain underneath the screen-space coordinates
	Position(const wxPoint& pt); // (implementation in ScenarioEditor.cpp)

	// Store all possible position representations in a union, instead of something
	// like inheritance and virtual functions, so we don't have to care about
	// dynamic memory allocation across DLLs.
	int type;
	union {
		struct { float x, y, z; } type0; // world-space coordinates
		struct { int x, y; } type1; // screen-space coordinates, to be projected onto terrain
		// type2: "same as previous" (e.g. for elevation-editing when the mouse hasn't moved)
	};

	// Constructs a position with the meaning "same as previous", which is handled
	// in unspecified (but usually obvious) ways by different message handlers.
	static Position Unchanged() { Position p; p.type = 2; return p; }

	// Only for use in the game, not the UI.
	// Implementations in Misc.cpp.
	CVector3D GetWorldSpace(bool floating = false) const;
	CVector3D GetWorldSpace(float h, bool floating = false) const;
	CVector3D GetWorldSpace(const CVector3D& prev, bool floating = false) const;
	void GetScreenSpace(float& x, float& y) const;
};
SHAREABLE_STRUCT(Position);


struct Colour
{
	Colour()
		: r(255), g(0), b(255)
	{
	}

	Colour(unsigned char r, unsigned char g, unsigned char b)
		: r(r), g(g), b(b)
	{
	}

	unsigned char r, g, b;
};
SHAREABLE_STRUCT(Colour);


typedef int ObjectID;
inline bool ObjectIDIsValid(ObjectID id) { return (id >= 0); }


struct sCinemaSplineNode
{
	Shareable<float> x, y, z, t;
public:
	sCinemaSplineNode(float px, float py, float pz) : x(px), y(py), z(pz), t(0.0f) {}
	sCinemaSplineNode() {}
	void SetTime(float _t) { t = _t; }
};
SHAREABLE_STRUCT(sCinemaSplineNode);

struct sCinemaPath
{
	Shareable<std::vector<AtlasMessage::sCinemaSplineNode> > nodes;
	Shareable<float> duration, x, y, z;
	Shareable<int> mode, growth, change, style;	// change == switch point

	sCinemaPath(float rx, float ry, float rz) : x(rx), y(ry), z(rz),
		mode(0), style(0), change(0), growth(0), duration(0) {}
	sCinemaPath() : x(0), y(0), z(0), mode(0), style(0),
		change(0), growth(0), duration(0) {}

	AtlasMessage::sCinemaPath operator-(const AtlasMessage::sCinemaPath& path)
	{
		return AtlasMessage::sCinemaPath(x - path.x, y - path.y, z - path.z);
	}
	AtlasMessage::sCinemaPath operator+(const AtlasMessage::sCinemaPath& path)
	{
		return AtlasMessage::sCinemaPath(x + path.x, y + path.y, z + path.z);
	}
};
SHAREABLE_STRUCT(sCinemaPath);

struct sCinemaTrack
{
	Shareable<std::wstring> name;
	Shareable<float> x, y, z, timescale, duration;
	Shareable<std::vector<AtlasMessage::sCinemaPath> > paths;

public:
	sCinemaTrack(float rx, float ry, float rz, std::wstring track) 
		: x(rx), y(ry), z(rz), timescale(1.f), duration(0), name(track) {}
	sCinemaTrack() : x(0), y(0), z(0), timescale(1.f), duration(0) {} 
};
SHAREABLE_STRUCT(sCinemaTrack);

struct eCinemaEventMode { enum { SMOOTH, SELECT, IMMEDIATE_PATH, IMMEDIATE_TRACK }; };
struct sCameraInfo
{
	Shareable<float> pX, pY, pZ, rX, rY, rZ;	// position and rotation
};
SHAREABLE_STRUCT(sCameraInfo);


//******Triggers*****


struct sTriggerParameter
{
	Shareable<int> row, column, xPos, yPos, xSize, ySize, parameterOrder;
	Shareable<std::wstring> name, inputType, windowType;
};
SHAREABLE_STRUCT(sTriggerParameter);

struct sTriggerSpec
{
	Shareable<std::vector<AtlasMessage::sTriggerParameter> > parameters;
	Shareable<std::wstring> displayName, functionName;

	bool operator== ( const std::wstring& name) const
	{
		return ( *displayName == name );
	}
};
SHAREABLE_STRUCT(sTriggerSpec);


struct sTriggerCondition
{
	sTriggerCondition() : linkLogic(1), not(false) {}
	sTriggerCondition(const std::wstring& _name) : linkLogic(1), not(false), name(_name) {}
	
	//displayName is used for selecting choice items in Atlas
	Shareable<std::wstring> name, functionName, displayName;	
	Shareable< std::vector<std::wstring> > parameters;
	
	//0 = none, 1 = and, 2 = or
	Shareable<int> linkLogic;
	Shareable<bool> not;

	bool operator== ( const std::wstring& _name ) const
	{
		return (*name == _name);
	}
};

SHAREABLE_STRUCT(sTriggerCondition);

struct sTriggerEffect
{
	sTriggerEffect() {}
	sTriggerEffect(const std::wstring& _name) : name(_name) {}

	Shareable<std::wstring> name, functionName, displayName;
	Shareable< std::vector<std::wstring> > parameters;
	//Shareable<bool> loop;

	bool operator== ( const std::wstring& _name )
	{
		return (*name == _name);
	}
};
SHAREABLE_STRUCT(sTriggerEffect);

struct sTrigger
{
	Shareable<std::wstring> name, group;
	Shareable< std::vector<sTriggerCondition> > conditions;
	Shareable< std::vector<sTriggerEffect> > effects;
	
	//For beginnings, the index of the term it comes before.  For ends, the index it comes after
	Shareable< std::vector<int> > logicBlocks, logicBlockEnds;
	Shareable< std::vector<bool> > logicNots;	//true if logicBlocks are not-ed
	Shareable<float> timeValue;
	Shareable<int> maxRuns;
	Shareable<bool> active;

	sTrigger() : timeValue(0), maxRuns(-1), active(0) {}
	sTrigger(std::wstring _name) : name(_name), timeValue(0), maxRuns(0), active(0) {}
	bool operator== (const sTrigger& trigger)
	{
		return (*name == *trigger.name);
	}
	bool operator!= (const sTrigger& trigger)
	{
		return (*name != *trigger.name);
	}
};
SHAREABLE_STRUCT(sTrigger);


struct sTriggerGroup
{
	Shareable<std::wstring> name, parentName;
	Shareable< std::vector<std::wstring> > children;
	Shareable< std::vector<sTrigger> > triggers;
	
	sTriggerGroup() { }
	sTriggerGroup(std::wstring _name) : name(_name) { }

	bool operator== (const sTriggerGroup& group) const
	{
		return (*name == *group.name);
	}
	bool operator== (const std::wstring& _name) const
	{
		return (*name == _name);
	}
	/*bool operator!= (const sTriggerGroup& group)
	{
		return (*name != *group.name);
	}*/
};

SHAREABLE_STRUCT(sTriggerGroup);


}

#endif // SHAREDTYPES_H__
