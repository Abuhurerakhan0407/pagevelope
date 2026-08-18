import { createClient } from "@/lib/supabase/server";

export const metadata = {
  title: "Analytics | Diagnostics",
};

export const dynamic = "force-dynamic";

export default async function AnalyticsPage() {
  const supabase = await createClient();

  const { data: events, error } = await supabase
    .from("analytics_events")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) {
    return (
      <div className="p-8">
        <h1 className="text-2xl font-bold mb-4">Analytics & Diagnostics</h1>
        <div className="text-red-500">Error loading analytics: {error.message}</div>
      </div>
    );
  }

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-4">Analytics & Diagnostics</h1>

      <div className="bg-white rounded-md shadow overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Event</th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">User / Workspace</th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Properties</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {events?.map((event) => (
              <tr key={event.id}>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{event.event_name}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{new Date(event.created_at).toLocaleString()}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  <div className="text-xs">User: {event.user_id || 'anonymous'}</div>
                  <div className="text-xs">WS: {event.workspace_id || 'none'}</div>
                </td>
                <td className="px-6 py-4 text-sm text-gray-500">
                  <pre className="text-xs bg-gray-100 p-2 rounded max-w-xs overflow-x-auto">{JSON.stringify(event.properties, null, 2)}</pre>
                </td>
              </tr>
            ))}
            {(!events || events.length === 0) && (
              <tr>
                <td colSpan={4} className="px-6 py-4 whitespace-nowrap text-sm text-center text-gray-500">No events found.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
