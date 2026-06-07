import { IPublicClientApplication, AccountInfo, SilentRequest } from '@azure/msal-browser';

export async function acquireToken(
  instance: IPublicClientApplication,
  account: AccountInfo,
  request: SilentRequest,
  redirectUri: string
): Promise<string> {
  try {
    const response = await instance.acquireTokenSilent({ ...request, account });
    return response.accessToken;
  } catch (e: any) {
    if (e?.errorCode === 'interaction_in_progress') throw e;
    try {
      await instance.acquireTokenRedirect({ ...request, redirectUri });
    } catch (redirectErr: any) {
      if (redirectErr?.errorCode !== 'interaction_in_progress') throw redirectErr;
    }
    throw new Error('Redirecting for auth...');
  }
}
