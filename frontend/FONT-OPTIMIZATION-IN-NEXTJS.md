Font optimization in Next.js is a way to load fonts faster and reduce layout shifts caused by character changes after loading.

Many websites appear to have loaded completely, but when the font is reappears, the text shifts, resulting in poor CLS and a non-stable user experience.

Next.js uses `next/font` to self-host fonts and manage preload/optimization to suit the webpage.

If you use Google Fonts via `next/font/google`, Next.js will load the fonts without making requests to Google from the browser at runtime.

The advantages are better performance control, reduced external requests, and more stable font rendering.

Choose only the font weights you actually need. Don't load every weight and style, as this will unnecessarily increase file size.

If your website has multiple languages, choose appropriate subsets, such as Latin or other languages ​​that are truly necessary.

In short, fonts aren't just about design; they directly impact the speed and stability of a webpage.

Fonts are a small resource that can have a big impact. Because it causes text to load slowly or the layout to shift after loading.

If using `next/font`, choose only the weights and subsets that are truly necessary, such as 400 and 700, instead of loading all weights.

For multi-page websites, place fonts at the appropriate layout level to avoid duplicate loading or distributing the configuration across multiple locations, making it difficult to maintain.

After optimizing fonts, review the CLS and visual stability to check that the text doesn't jump and the webpage is more stable.
