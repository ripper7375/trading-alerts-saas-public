import { defineTool } from '@lovable.dev/mcp-js';
import { z } from 'zod';
import { supabaseForUser } from '../supabase';

export default defineTool({
  name: 'update_profile',
  title: 'Update my profile',
  description: "Update the signed-in user's display name and/or avatar URL.",
  inputSchema: {
    display_name: z
      .string()
      .trim()
      .min(1)
      .max(80)
      .optional()
      .describe('New display name.'),
    avatar_url: z.string().url().optional().describe('New avatar image URL.'),
  },
  annotations: {
    readOnlyHint: false,
    destructiveHint: false,
    openWorldHint: false,
  },
  handler: async ({ display_name, avatar_url }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return {
        content: [{ type: 'text', text: 'Not authenticated' }],
        isError: true,
      };
    }
    if (display_name === undefined && avatar_url === undefined) {
      return {
        content: [
          { type: 'text', text: 'Provide display_name or avatar_url.' },
        ],
        isError: true,
      };
    }
    const supabase = supabaseForUser(ctx);
    const patch: Record<string, string> = {};
    if (display_name !== undefined) patch.display_name = display_name;
    if (avatar_url !== undefined) patch.avatar_url = avatar_url;
    const { data, error } = await supabase
      .from('profiles')
      .update(patch)
      .eq('id', ctx.getUserId())
      .select('id, display_name, avatar_url')
      .maybeSingle();
    if (error)
      return {
        content: [{ type: 'text', text: error.message }],
        isError: true,
      };
    return {
      content: [{ type: 'text', text: JSON.stringify(data, null, 2) }],
      structuredContent: { profile: data },
    };
  },
});
