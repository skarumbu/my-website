import { IPublicClientApplication, AccountInfo, SilentRequest } from '@azure/msal-browser';

const REDIRECT_TS_KEY = 'msal_redirect_ts';
const REDIRECT_COOLDOWN_MS = 30_000;

export async function acquireToken(
  instance: IPublicClientApplication,
  account: AccountInfo,
  request: SilentRequest,
  redirectUri: string
): Promise<string> {
  try {
    const response = await instance.acquireTokenSilent({ ...request, account });
    sessionStorage.removeItem(REDIRECT_TS_KEY);
    return response.accessToken;
  } catch (e: any) {
    if (e?.errorCode === 'interaction_in_progress') throw e;

    const last = Number(sessionStorage.getItem(REDIRECT_TS_KEY) ?? 0);
    if (Date.now() - last < REDIRECT_COOLDOWN_MS) {
      sessionStorage.removeItem(REDIRECT_TS_KEY);
      throw new Error('Sign-in failed — please refresh and try again.');
    }

    sessionStorage.setItem(REDIRECT_TS_KEY, String(Date.now()));
    try {
      await instance.acquireTokenRedirect({ ...request, redirectUri });
    } catch (redirectErr: any) {
      if (redirectErr?.errorCode !== 'interaction_in_progress') throw redirectErr;
    }
    throw new Error('Redirecting for auth...');
  }
}
