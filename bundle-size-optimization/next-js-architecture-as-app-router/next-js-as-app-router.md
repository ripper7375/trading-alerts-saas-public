What beginners often miss with Next.js App Router: Server Components can significantly reduce web-side JavaScript, resulting in instantly smoother website development 🚀
Many people migrate to App Router only to find their websites remain sluggish.
The most common reason: Unintentionally making everything a client component.
The core idea of ​​App Router:
In the app/ folder, most files “run on the server” from the start.
This eliminates the need to send JavaScript to the browser for server-side components.
The visible results:

1. Smaller JS bundle
2. Improved TTFB and homepage loading (especially on mobile)
3. Reduced user-side memory/CPU usage
4. SEO-friendly because HTML comes from the server
   What beginners often miss (and that leads to excessive JS):
   Mistake 1: Placing “use client” at the top of the page, turning the entire tree into a client component.
   Just needing one button. Instead, it drags the entire page to the client side.
   Mistake 2: Placing state, useEffect, and event handler in the page file.
   Whenever there's a hook or event, it immediately has to be a Client Component.
   Mistake 3: Retrieving data using `fetch` on the client when it could be done on the server.
   When `fetch` on the client, you have to wait for the JS to load before making an API call.
   Mistake 4: Sending large amounts of data through props to the Client Component.
   For example, sending a long list from the server to the client and then mapping/rendering it.
   In summary: The browser must receive the data + run JS to create the UI.
   The correct way of thinking: “Make the Server the default.”
5. Page structure + data retrieval + mapping/rendering lists should be done in the Server Component.
6. Parts that require clicking/typing/have state should be separated into small Client Components.
7. Avoid having large files with “use client” unless necessary.
   Example of a practical approach. (Explaining with a visual analogy)
   Blog list page

- Server Component: Pulls posts from the DB/API and renders them as a list of links.
- Client Component: Only has a search box or a small filter button.
  The result is that a 100-line list doesn't need to be generated with JS on the user's machine.
  A trick that most people don't know: "The scope of 'use client' spreads throughout the subtree.
  If you embed 'use client' in the layout or page file,
  all child components will also become clients (JS will be passed along).
  Therefore, you should place 'use client' as close as possible to the interactive part.
  Server Components also help with two other things:

1. They hide secrets more securely.
   For example, tokens for calling internal services don't have to be leaked to the browser.
2. They reduce the number of repetitive requests.
   Because data fetching is done on the server and rendered directly.
   Symptoms that indicate your website is accidentally acting too much like a client:

- When the homepage loads, devtools displays unusually large JS chunks.
- You have to wait longer than you should for "hydration," even though the page isn't very interactive.
- Large lists or tables slow down mobile devices.
  Quick optimization checklist:

1. Remove `use client` from the page/layout unless absolutely necessary.
2. Separate interactive components into smaller files and then add `use client` to them.
3. Move `fetch` to a Server Component or route handler.
4. Avoid passing large props to the client side unless absolutely necessary.
5. If using a UI library that forces the client to wrap only the necessary parts, use it sparingly.
   In short:
   App Router doesn't automatically make websites smoother.
   Websites become smoother when we “choose the right running side.”
   Server Components speed up HTML transmission and only pass the necessary JS. ✨
   A small note for those working in real-world scenarios:
   Start by making heavy pages (list/detail) server-side first.
   Then add interactivity gradually. Controlling performance becomes much easier this way.
