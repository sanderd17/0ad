#include "precompiled.h"

#include <stdio.h>
#include <wchar.h>

#include "lib.h"
#include "sysdep/sysdep.h"
#include "udbg.h"

// these are basic POSIX-compatible backends for the sysdep.h functions.
// Win32 has better versions which override these.

void display_msg(const char* caption, const char* msg)
{
	fprintf(stderr, "%s: %s\n", caption, msg);
}

void wdisplay_msg(const wchar_t* caption, const wchar_t* msg)
{
	fwprintf(stderr, L"%ls: %ls\n", caption, msg);
}


int get_executable_name(char* n_path, size_t buf_size)
{
	UNUSED(n_path);
	UNUSED(buf_size);
	return -ENOSYS;
}

ErrorReaction display_error_impl(const wchar_t* text, int flags)
{
	wprintf(L"%s\n", text);

	const bool manual_break   = flags & DE_MANUAL_BREAK;
	const bool allow_suppress = flags & DE_ALLOW_SUPPRESS;
	const bool no_continue    = flags & DE_NO_CONTINUE;

	// until valid input given:
	for(;;)
	{
		if(!no_continue)
			printf("(C)ontinue, ");
		if(allow_suppress)
			printf("(S)uppress, ");
		printf("(B)reak, Launch (D)ebugger, or (E)xit?\n");
		// TODO Should have some kind of timeout here.. in case you're unable to
		// access the controlling terminal (As might be the case if launched
		// from an xterm and in full-screen mode)
		int c = getchar();
		// note: don't use tolower because it'll choke on EOF
		switch(c)
		{
		case EOF:
		case 'd': case 'D':
			udbg_launch_debugger();
			//-fallthrough

		case 'b': case 'B':
			if(manual_break)
				return ER_BREAK;
			debug_break();
			return ER_CONTINUE;

		case 'c': case 'C':
			if(!no_continue)
                return ER_CONTINUE;
			// continue isn't allowed, so this was invalid input. loop again.
			break;
		case 's': case 'S':
			if(allow_suppress)
				return ER_SUPPRESS;
			// suppress isn't allowed, so this was invalid input. loop again.
			break;

		case 'e': case 'E':
			abort();
			return ER_EXIT;	// placebo; never reached
		}
	}
}
