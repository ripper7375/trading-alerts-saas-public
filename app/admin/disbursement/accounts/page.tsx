import { redirect } from 'next/navigation';

/**
 * RiseWorks Accounts Page — retired (Session 6-6, A1-6)
 *
 * RiseWorks is archived (F42, Session 4A-W1) and Wise is the live
 * disbursement provider (Session 4A-W7). This route now redirects to
 * `/admin/disbursement/recipients`, which shows live Wise recipients plus a
 * read-only historical RiseWorks tab — the create/sync actions this page
 * used to expose (`POST /api/disbursement/riseworks/accounts`,
 * `POST /api/disbursement/riseworks/sync`) are intentionally not carried
 * forward; RiseWorks stays archived, not un-archived.
 */
export default function RiseWorksAccountsRedirectPage(): never {
  redirect('/admin/disbursement/recipients');
}
