import { auth, defineMcp } from '@lovable.dev/mcp-js';
import getProfileTool from './tools/get-profile';
import updateProfileTool from './tools/update-profile';

const projectRef =
  import.meta.env.VITE_SUPABASE_PROJECT_ID ?? 'project-ref-unset';

export default defineMcp({
  name: 'shared-app-engine',
  title: 'Shared App Engine',
  version: '0.1.0',
  instructions:
    "Tools for Shared App Engine. Use `get_profile` to read the signed-in user's profile and `update_profile` to change their display name or avatar.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: 'authenticated',
  }),
  tools: [getProfileTool, updateProfileTool],
});
