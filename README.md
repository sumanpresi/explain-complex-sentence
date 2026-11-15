# Sentence Lens

A Google Drive reader for desktop and foldable phones. Select a passage in a document and get a one-sentence explanation from Gemini, OpenAI, or Claude.

## Vercel and Google Cloud

1. Import `sumanpresi/explain-complex-sentence` into Vercel. The repository uses the Other framework preset, `public` for static files, and `api/ai.mjs` as the Vercel Function.
2. In Google Cloud project **Task Memory**, enable the Google Drive API. In the web OAuth client matching the ID in `public/app.mjs`, add the deployed Vercel origin under **Authorized JavaScript origins**. Include only the scheme and hostname. Add the Sites origin there too if you plan to authorize Drive on Sites.
3. Confirm the consent screen is External and In production and that it permits the Drive read-only and per-file (drive.file) scopes. Sign in as `sumanpresi86geology@gmail.com`.
4. In **Model settings**, choose the provider and model, enter a provider API key, and save. The key is held in browser memory and passed through the hosting runtime to the matching provider. No OAuth client secret or provider key is checked into the repository.
5. Open the Vercel URL in Chrome on your Galaxy Fold and use **Install app** or Chrome's **Add to Home screen → Install**.

## Document support

Drive search uses file names and indexed contents. The in-app reader extracts text from Google Docs, Sheets and Slides, text-based PDFs, modern Office documents, OpenDocument files, EPUB, and plain text. Images, audio, and video can be previewed. For scanned PDFs, legacy documents, restricted files, or other formats, open them in Drive and paste the passage into the reader. Documents and Drive tokens stay in the browser. Only the passage and its immediate context are sent for an explanation.

The model selector contains the requested IDs. Access depends on the provider and API key. Live, transcription, or image models may not support this app's text-generation API.

## Sites

`node scripts/build.mjs` generates the install icons and the Sites Worker under `dist/server`. The Sites and Vercel runtimes share the same provider handlers.

## Writing style sync

Connect Drive, open Write Like Suman, and save the notes to Google Drive. The app creates Sentence Lens - Writing Style.json in My Drive and loads it after Drive connects on each device. Drafts use the saved notes with the model selected in Model settings. Under Learn from work mail you can also paste a batch of your own sent emails and have the selected model write the style notes from them; the pasted emails are not stored. The browser keeps a local copy for drafting when Drive is disconnected.
