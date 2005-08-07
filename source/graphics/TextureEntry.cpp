#include "precompiled.h"

#include <map>

#include "ogl.h"
#include "res/ogl_tex.h"

#include "CLogger.h"

#include "TextureEntry.h"
#include "TextureManager.h"
#include "TerrainProperties.h"
#include "Texture.h"
#include "Renderer.h"

#define LOG_CATEGORY "graphics"

using namespace std;

map<Handle, CTextureEntry *> CTextureEntry::m_LoadedTextures;

/////////////////////////////////////////////////////////////////////////////////////
// CTextureEntry constructor
CTextureEntry::CTextureEntry(CTerrainProperties *props, CStr path):
	m_pProperties(props),
	m_Bitmap(NULL),
	m_Handle(-1),
	m_BaseColor(0),
	m_BaseColorValid(false),
	m_TexturePath(path)
{
	if (m_pProperties)
		m_Groups = m_pProperties->GetGroups();
	
	GroupVector::iterator it=m_Groups.begin();
	for (;it!=m_Groups.end();++it)
		(*it)->AddTerrain(this);
	
	long slashPos=m_TexturePath.ReverseFind("/");
	long dotPos=m_TexturePath.ReverseFind(".");
	if (slashPos == -1)
		slashPos = 0;
	else
		slashPos++; // Skip the actual slash
	if (dotPos == -1)
		dotPos = m_TexturePath.Length();
	m_Tag = m_TexturePath.GetSubstring(slashPos, dotPos-slashPos);
}

/////////////////////////////////////////////////////////////////////////////////////
// CTextureEntry destructor
CTextureEntry::~CTextureEntry()
{
	map<Handle,CTextureEntry *>::iterator it=m_LoadedTextures.find(m_Handle);
	if (it != m_LoadedTextures.end())
		m_LoadedTextures.erase(it);
	
	if (m_Handle > 0)
		tex_free(m_Handle);

	for (GroupVector::iterator it=m_Groups.begin();it!=m_Groups.end();++it)
		(*it)->RemoveTerrain(this);
}

/////////////////////////////////////////////////////////////////////////////////////
// LoadTexture: actually load the texture resource from file
void CTextureEntry::LoadTexture()	
{
	CTexture texture;
	texture.SetName(m_TexturePath);
	if (g_Renderer.LoadTexture(&texture,GL_REPEAT)) {
		m_Handle=texture.GetHandle();
		m_LoadedTextures[m_Handle] = this;
	} else {
		m_Handle=0;
	}
}

////////////////////////////////////////////////////////////////////////////////////////////////////////////
// BuildBaseColor: calculate the root color of the texture, used for coloring minimap, and store
// in m_BaseColor member
void CTextureEntry::BuildBaseColor()
{
	if (m_pProperties && m_pProperties->HasBaseColor())
	{
		m_BaseColor=m_pProperties->GetBaseColor();
		m_BaseColorValid=true;
		return;
	}

	Handle handle=GetHandle();
	g_Renderer.BindTexture(0,tex_id(handle));

	// get root color for coloring minimap by querying root level of the texture 
	// (this should decompress any compressed textures for us),
	// then scaling it down to a 1x1 size 
	//	- an alternative approach of just grabbing the top level of the mipmap tree fails 
	//	(or gives an incorrect colour) in some cases: 
	//		- suspect bug on Radeon cards when SGIS_generate_mipmap is used 
	//		- any textures without mipmaps
	// we'll just take the basic approach here:
	int width,height;
	glGetTexLevelParameteriv(GL_TEXTURE_2D,0,GL_TEXTURE_WIDTH,&width);
	glGetTexLevelParameteriv(GL_TEXTURE_2D,0,GL_TEXTURE_HEIGHT,&height);

	unsigned char* buf=new unsigned char[width*height*4];
	glGetTexImage(GL_TEXTURE_2D,0,GL_BGRA_EXT,GL_UNSIGNED_BYTE,buf);
	gluScaleImage(GL_BGRA_EXT,width,height,GL_UNSIGNED_BYTE,buf,
			1,1,GL_UNSIGNED_BYTE,&m_BaseColor);
	delete[] buf;

	m_BaseColorValid=true;
}


CTextureEntry *CTextureEntry::GetByHandle(Handle handle)
{
	map<Handle, CTextureEntry *>::iterator it=m_LoadedTextures.find(handle);
	if (it != m_LoadedTextures.end())
		return it->second;
	else
		return NULL;
}
