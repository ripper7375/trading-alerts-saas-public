import { redirect } from 'next/navigation';

export default function DashboardsIndexPage(): never {
  redirect('/admin/dashboards/executive');
}
