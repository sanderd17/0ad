/* Copyright (C) 2009 Wildfire Games.
 * This file is part of 0 A.D.
 *
 * 0 A.D. is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 2 of the License, or
 * (at your option) any later version.
 *
 * 0 A.D. is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with 0 A.D.  If not, see <http://www.gnu.org/licenses/>.
 */

#include "precompiled.h"

#include "ps/Util.h"

#include "lib/posix/posix_utsname.h"
#include "lib/posix/posix_sock.h"
#include "lib/ogl.h"
#include "lib/timer.h"
#include "lib/bits.h"	// round_up
#include "lib/allocators/shared_ptr.h"
#include "lib/sysdep/gfx.h"
#include "lib/sysdep/snd.h"
#include "lib/sysdep/cpu.h"
#include "lib/sysdep/os_cpu.h"
#include "lib/sysdep/arch/x86_x64/topology.h"
#include "lib/tex/tex.h"
#include "lib/file/io/io_align.h"	// BLOCK_SIZE

#include "ps/GameSetup/Config.h"
#include "ps/GameSetup/GameSetup.h"
#include "ps/Game.h"
#include "ps/Filesystem.h"
#include "ps/VideoMode.h"
#include "renderer/Renderer.h"
#include "maths/MathUtil.h"
#include "graphics/GameView.h"

extern CStrW g_CursorName;

static std::string SplitExts(const char *exts)
{
	std::string str = exts;
	std::string ret = "";
	size_t idx = str.find_first_of(" ");
	while(idx != std::string::npos)
	{
		if(idx >= str.length() - 1)
		{
			ret += str;
			break;
		}

		ret += str.substr(0, idx);
		ret += "\n";
		str = str.substr(idx + 1);
		idx = str.find_first_of(" ");
	}

	return ret;
}


void WriteSystemInfo()
{
	TIMER(L"write_sys_info");

	// get_cpu_info and gfx_detect already called during init - see call site
	snd_detect();

	struct utsname un;
	uname(&un);

	fs::wpath pathname(psLogDir()/L"system_info.txt");
	FILE* f;
	errno_t err = _wfopen_s(&f, pathname.string().c_str(), L"w");
	if(err != 0)
		return;

	// current timestamp (redundant WRT OS timestamp, but that is not
	// visible when people are posting this file's contents online)
	{
	wchar_t timestampBuf[100] = {'\0'};
	time_t seconds;
	time(&seconds);
	struct tm* t = gmtime(&seconds);
	const size_t charsWritten = wcsftime(timestampBuf, ARRAY_SIZE(timestampBuf), L"(generated %Y-%m-%d %H:%M:%S UTC)", t);
	debug_assert(charsWritten != 0);
	fprintf(f, "%ls\n\n", timestampBuf);
	}

	// OS
	fprintf(f, "OS             : %s %s (%s)\n", un.sysname, un.release, un.version);

	// CPU
	fprintf(f, "CPU            : %s, %s (%dx%dx%d)", un.machine, cpu_IdentifierString(), (int)cpu_topology_NumPackages(), (int)cpu_topology_CoresPerPackage(), (int)cpu_topology_LogicalPerCore());
	const double cpu_freq = os_cpu_ClockFrequency();
	if(cpu_freq != 0.0f)
	{
		if(cpu_freq < 1e9)
			fprintf(f, ", %.2f MHz\n", cpu_freq*1e-6);
		else
			fprintf(f, ", %.2f GHz\n", cpu_freq*1e-9);
	}
	else
		fprintf(f, "\n");

	// memory
	fprintf(f, "Memory         : %u MiB; %u MiB free\n", (unsigned)os_cpu_MemorySize(), (unsigned)os_cpu_MemoryAvailable());

	// graphics
	fprintf(f, "Graphics Card  : %ls\n", gfx_card);
	fprintf(f, "OpenGL Drivers : %s; %ls\n", glGetString(GL_VERSION), gfx_drv_ver);
	fprintf(f, "Video Mode     : %dx%d:%d\n", g_VideoMode.GetXRes(), g_VideoMode.GetYRes(), g_VideoMode.GetBPP());

	// sound
	fprintf(f, "Sound Card     : %ls\n", snd_card);
	fprintf(f, "Sound Drivers  : %ls\n", snd_drv_ver);


	//
	// network name / ips
	//

	// note: can't use un.nodename because it is for an
	// "implementation-defined communications network".
	char hostname[128] = "(unknown)";
	(void)gethostname(hostname, sizeof(hostname)-1);
	// -1 makes sure it's 0-terminated. if the function fails,
	// we display "(unknown)" and will skip IP output below.
	fprintf(f, "Network Name   : %s", hostname);

	{
		// ignore exception here - see https://connect.microsoft.com/VisualStudio/feedback/ViewFeedback.aspx?FeedbackID=114032
		hostent* host = gethostbyname(hostname);
		if(!host)
			goto no_ip;
		struct in_addr** ips = (struct in_addr**)host->h_addr_list;
		if(!ips)
			goto no_ip;

		// output all IPs (> 1 if using VMware or dual ethernet)
		fprintf(f, " (");
		for(size_t i = 0; i < 256 && ips[i]; i++)	// safety
		{
			// separate entries but avoid trailing comma
			if(i != 0)
				fprintf(f, ", ");
			fprintf(f, "%s", inet_ntoa(*ips[i]));
		}
		fprintf(f, ")");
	}

no_ip:
	fprintf(f, "\n");


	// OpenGL extensions (write them last, since it's a lot of text)
	const char* exts = ogl_ExtensionString();
	if (!exts) exts = "{unknown}";
	fprintf(f, "\nOpenGL Extensions: \n%s\n", SplitExts(exts).c_str());

	fclose(f);
	f = 0;
}


// not thread-safe!
static const wchar_t* HardcodedErrorString(int err)
{
	static wchar_t description[200];
	error_description_r((LibError)err, description, ARRAY_SIZE(description));
	return description;
}

// not thread-safe!
const wchar_t* ErrorString(int err)
{
	// language file not available (yet)
	return HardcodedErrorString(err);

	// TODO: load from language file
}



// write the specified texture to disk.
// note: <t> cannot be made const because the image may have to be
// transformed to write it out in the format determined by <fn>'s extension.
static LibError tex_write(Tex* t, const VfsPath& filename)
{
	const std::wstring extension = fs::extension(filename);

	DynArray da;
	RETURN_ERR(tex_encode(t, extension, &da));

	// write to disk
	LibError ret = INFO::OK;
	{
		(void)da_set_size(&da, round_up(da.cur_size, BLOCK_SIZE));
		shared_ptr<u8> file = DummySharedPtr(da.base);
		const ssize_t bytes_written = g_VFS->CreateFile(filename, file, da.pos);
		if(bytes_written > 0)
			debug_assert(bytes_written == (ssize_t)da.pos);
		else
			ret = (LibError)bytes_written;
	}

	(void)da_free(&da);
	return ret;
}


static size_t s_nextScreenshotNumber;

// <extension> identifies the file format that is to be written
// (case-insensitive). examples: "bmp", "png", "jpg".
// BMP is good for quick output at the expense of large files.
void WriteScreenshot(const std::wstring& extension)
{
	// get next available numbered filename
	// note: %04d -> always 4 digits, so sorting by filename works correctly.
	const VfsPath basenameFormat(L"screenshots/screenshot%04d");
	const VfsPath filenameFormat = fs::change_extension(basenameFormat, extension);
	VfsPath filename;
	fs_util::NextNumberedFilename(g_VFS, filenameFormat, s_nextScreenshotNumber, filename);

	const size_t w = (size_t)g_xres, h = (size_t)g_yres;
	const size_t bpp = 24;
	GLenum fmt = GL_RGB;
	int flags = TEX_BOTTOM_UP;
	// we want writing BMP to be as fast as possible,
	// so read data from OpenGL in BMP format to obviate conversion.
	if(!wcscasecmp(extension.c_str(), L".bmp"))
	{
		fmt = GL_BGR;
		flags |= TEX_BGR;
	}

	const size_t img_size = w * h * bpp/8;
	const size_t hdr_size = tex_hdr_size(filename);
	shared_ptr<u8> buf = io_Allocate(hdr_size+img_size);
	GLvoid* img = buf.get() + hdr_size;
	Tex t;
	if(tex_wrap(w, h, bpp, flags, buf, hdr_size, &t) < 0)
		return;
	glReadPixels(0, 0, (GLsizei)w, (GLsizei)h, fmt, GL_UNSIGNED_BYTE, img);
	(void)tex_write(&t, filename);
	tex_free(&t);
}



// Similar to WriteScreenshot, but generates an image of size 640*tiles x 480*tiles.
void WriteBigScreenshot(const std::wstring& extension, int tiles)
{
	// If the game hasn't started yet then use WriteScreenshot to generate the image.
	if(g_Game == NULL){ WriteScreenshot(L".bmp"); return; }

	// get next available numbered filename
	// note: %04d -> always 4 digits, so sorting by filename works correctly.
	const VfsPath basenameFormat(L"screenshots/screenshot%04d");
	const VfsPath filenameFormat = fs::change_extension(basenameFormat, extension);
	VfsPath filename;
	fs_util::NextNumberedFilename(g_VFS, filenameFormat, s_nextScreenshotNumber, filename);

	// Slightly ugly and inflexible: Always draw 640*480 tiles onto the screen, and
	// hope the screen is actually large enough for that.
	const int tile_w = 640, tile_h = 480;
	debug_assert(g_xres >= tile_w && g_yres >= tile_h);

	const int img_w = tile_w*tiles, img_h = tile_h*tiles;
	const int bpp = 24;
	GLenum fmt = GL_RGB;
	int flags = TEX_BOTTOM_UP;
	// we want writing BMP to be as fast as possible,
	// so read data from OpenGL in BMP format to obviate conversion.
	if(!wcscasecmp(extension.c_str(), L".bmp"))
	{
		fmt = GL_BGR;
		flags |= TEX_BGR;
	}

	const size_t img_size = img_w * img_h * bpp/8;
	const size_t tile_size = tile_w * tile_h * bpp/8;
	const size_t hdr_size = tex_hdr_size(filename);
	void* tile_data = malloc(tile_size);
	if(!tile_data)
		WARN_ERR_RETURN(ERR::NO_MEM);
	shared_ptr<u8> img_buf = io_Allocate(hdr_size+img_size);

	Tex t;
	GLvoid* img = img_buf.get() + hdr_size;
	if(tex_wrap(img_w, img_h, bpp, flags, img_buf, hdr_size, &t) < 0)
		return;

	ogl_WarnIfError();

	// Resize various things so that the sizes and aspect ratios are correct
	{
		g_Renderer.Resize(tile_w, tile_h);
		SViewPort vp = { 0, 0, tile_w, tile_h };
		g_Game->GetView()->GetCamera()->SetViewPort(vp);
		g_Game->GetView()->GetCamera()->SetProjection(CGameView::defaultNear, CGameView::defaultFar, CGameView::defaultFOV);
	}

	// Temporarily move everything onto the front buffer, so the user can
	// see the exciting progress as it renders (and can tell when it's finished).
	// (It doesn't just use SwapBuffers, because it doesn't know whether to
	// call the SDL version or the Atlas version.)
	GLint oldReadBuffer, oldDrawBuffer;
	glGetIntegerv(GL_READ_BUFFER, &oldReadBuffer);
	glGetIntegerv(GL_DRAW_BUFFER, &oldDrawBuffer);
	glDrawBuffer(GL_FRONT);
	glReadBuffer(GL_FRONT);

	// Hide the cursor
	CStrW oldCursor = g_CursorName;
	g_CursorName = L"";

	// Render each tile
	for (int tile_y = 0; tile_y < tiles; ++tile_y)
	{
		for (int tile_x = 0; tile_x < tiles; ++tile_x)
		{
			// Adjust the camera to render the appropriate region
			g_Game->GetView()->GetCamera()->SetProjectionTile(tiles, tile_x, tile_y);

			RenderGui(false);
			Render();
			RenderGui(true);

			// Copy the tile pixels into the main image
			glReadPixels(0, 0, tile_w, tile_h, fmt, GL_UNSIGNED_BYTE, tile_data);
			for (int y = 0; y < tile_h; ++y)
			{
				void* dest = (char*)img + ((tile_y*tile_h + y) * img_w + (tile_x*tile_w)) * bpp/8;
				void* src = (char*)tile_data + y * tile_w * bpp/8;
				cpu_memcpy(dest, src, tile_w * bpp/8);
			}
		}
	}

	// Restore the old cursor
	g_CursorName = oldCursor;

	// Restore the buffer settings
	glDrawBuffer(oldDrawBuffer);
	glReadBuffer(oldReadBuffer);

	// Restore the viewport settings
	{
		g_Renderer.Resize(g_xres, g_yres);
		SViewPort vp = { 0, 0, g_xres, g_yres };
		g_Game->GetView()->GetCamera()->SetViewPort(vp);
		g_Game->GetView()->GetCamera()->SetProjection(CGameView::defaultNear, CGameView::defaultFar, CGameView::defaultFOV);

		g_Game->GetView()->GetCamera()->SetProjectionTile(1, 0, 0);
	}

	(void)tex_write(&t, filename);
	tex_free(&t);
	free(tile_data);
}
