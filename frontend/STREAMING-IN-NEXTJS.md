Streaming in Next.js allows you to show the user a portion of the UI before all data or components have finished loading.

Normally, if a page has to wait for multiple data sections to load, the user might see a long blank page. Streaming helps display the sections that are ready first.

In App Router, we can use `loading.tsx` and React Suspense to separate the sections waiting for data from the sections that are being displayed immediately.

For example, the header and page structure are displayed first, followed by product lists, comments, or dashboard cards.

The advantage is that the user feels the website is more responsive, even if some data isn't fully ready.

Streaming is suitable for pages with multiple data sets or where some APIs are slower than others.

However, the loading state should be well-designed; avoid leaving too much skeletal information that makes the page look cluttered or causes layout shifts.

In short, streaming changes the experience from "waiting for the whole page" to "seeing parts first, allowing for faster usability."

Streaming makes web pages feel faster because users see the shell or some data beforehand, instead of waiting for all APIs to load simultaneously.

It's ideal for pages with multiple sections, such as dashboards, product details, or articles with recommendations/comments. Loading can be done in reverse.

What should be designed in conjunction is a loading state or skeleton that is close in size to the actual content, to reduce layout shifts when data arrives.

If streaming is used well, users will feel that the website starts responding quickly, even though some data is still slowly loading in the background.
