# MMPlayer Privacy Policy

**Last updated:** October 29, 2026

The current public policy, also available in Spanish and Portuguese, is maintained at [https://mmplayer.pescalerag.com/privacy](https://mmplayer.pescalerag.com/privacy). The text below is the English copy of that policy.

## 1. Who is responsible

MMPlayer and this website are operated by **José Escalera**, known as **pescalerag**, in **Spain**. For privacy questions, access or deletion requests, contact [pescalerag.dev@gmail.com](mailto:pescalerag.dev@gmail.com).

This policy covers the Android and Windows app, its optional online integrations and [mmplayer.pescalerag.com](https://mmplayer.pescalerag.com). Availability of features differs between platforms. It does not replace the policies of external services.

## 2. Your library stays on your device

MMPlayer plays your own audio files. Library metadata, file paths, playlists, tags, ratings, favourites, queues, listening history and statistics, lyrics, cached images and settings are stored on your device. There is no MMPlayer account or developer-operated cloud library service. The app does not upload your music library or listening history to the developer.

Local error logs can contain technical messages, file paths or track metadata. They remain on the device unless you choose to send them with a support request. MMPlayer has no advertising SDK or separate automatic crash-reporting or behavioural analytics service. The purchase provider described below does process technical and transaction data.

## 3. Online features and recipients

Network requests disclose your IP address and technical request information to the receiving service. These requests are not all limited to a manual search: missing artwork may be fetched automatically after scanning, and purchase status is checked when the mobile app starts.

- **Artwork — Deezer:** artist names or artist and album names are sent to the Deezer catalogue to find artist images, album artwork and public images for Discord. Returned images may be downloaded from Deezer's image servers. Local audio and image files are not uploaded for these searches. See [Deezer](https://www.deezer.com/legal/personal-datas).
- **Lyrics — LRCLIB:** track title and artist names are sent to [LRCLIB](https://lrclib.net) when fetching lyrics, including batch synchronisation. The returned lyrics may be saved locally.
- **Updates and supporter lists — GitHub:** the app downloads update information and the public Hall of Fame list from GitHub Pages or raw GitHub files. The website also queries GitHub to resolve release downloads. These services receive connection data; your library is not included. See [GitHub's privacy statement](https://docs.github.com/en/site-policy/privacy-policies/github-general-privacy-statement).
- **Purchases — Google Play and RevenueCat:** on Android, the RevenueCat SDK is initialised at app startup to check access to paid extras and restore purchases. It can create an installation/customer identifier even if you do not buy anything. RevenueCat processes technical app/device information, access/last-seen information, product and entitlement status, and purchase tokens or transaction records when applicable. MMPlayer does not receive your payment-card details. See [RevenueCat's privacy policy](https://www.revenuecat.com/privacy) and [Google's privacy policy](https://policies.google.com/privacy).
- **Optional public recognition:** if you submit a Hall of Fame alias, that alias, your tier and submission time are sent to RevenueCat. Your chosen alias and associated recognition information may be published in the supporter list. Do not submit information you do not want to make public. You can request withdrawal by email.

## 4. Discord Rich Presence

**Discord Rich Presence is off by default.** When you enable it in Settings → Other, the Windows app connects to your local Discord client through IPC. It publishes the playing track's title, artist names, album text, a public artwork URL or the MMPlayer icon, playback timing, and links to the MMPlayer website. Discord associates this activity with your Discord account and displays it according to your Discord activity and visibility settings.

For a local cover, the app may query Deezer with the artist and album names to find a public cover. It does not upload the local cover or audio file. MMPlayer does not ask for your Discord password, user token or bot token, and does not read your messages, contacts or server membership for this feature.

Pausing playback, turning off Rich Presence or closing MMPlayer clears the app's activity. Disabling the option disconnects the integration. This stops new sharing; it cannot remove screenshots or information others have already seen. Discord manages any retention within its own service under [Discord's privacy policy](https://discord.com/privacy).

The reviewed Android build does not yet include the native Discord transport; enabling the setting there does not provide the same live connection. Use Discord features only if you meet Discord's applicable minimum age and other requirements.

## 5. Permissions, casting and backups

Media/storage permissions let the app scan and play selected audio and apply file changes you request. Android's audio-recording permission is used for audio-session visualisation/effects, not to upload microphone recordings. Network permissions support online features and local-network playback; system-settings permission supports actions such as setting a ringtone. You can manage permissions in your operating system; refusing one may disable the related feature.

If you start LocalCast or Chromecast where available, audio, artwork and playback metadata are sent to the receiver or browser/device you connect. LocalCast exposes a local-network player while the session is active. Use a trusted network and stop casting when finished.

Exported backups and shared files can include your library data, settings and other selected content. You decide where to save or share them. Copies outside the app, changes embedded in original audio files, operating-system backups and files retained after uninstalling on Windows are not necessarily removed by clearing app data or uninstalling.

## 6. This website and support

The website uses Cloudflare Pages. Cloudflare receives IP addresses, requested URLs and other connection/security information to deliver and protect the site, and may use technical security cookies. No optional web analytics or advertising tracker has been enabled by the operator. Your chosen language is saved in browser local storage as `mmplayer.language`; you can remove it through browser site-data settings. See [Cloudflare's privacy policy](https://www.cloudflare.com/privacypolicy/).

When you email us or submit the Google Forms support form, we receive the content and any contact details or attachments you provide. Google processes the form/email service data. Public GitHub issues, Ko-fi, Google Play and other external links are governed by those services' policies when you use them. Avoid sending credentials, payment details or unnecessary personal information in support messages or public issues.

## 7. Purposes, legal bases and international processing

Where personal data is processed by the operator, the purposes and legal bases are: providing requested app, purchase and support services (performance of a contract or steps you request); optional activity sharing and publication of your alias (your consent, which you can withdraw); delivering and securing the website and handling technical incidents (legitimate interests in operating a secure service); and meeting applicable legal obligations.

Optional online features send the information needed for the feature you use; local music playback does not require you to enable Discord or submit a public alias. The operator does not sell your personal data or use your library for advertising, and does not make decisions with legal or similarly significant effects through automated profiling.

Providers may process data outside Spain and the European Economic Area. Their applicable terms and privacy notices describe their processing locations and transfer safeguards. You may contact us for information about recipients and safeguards applicable to data we manage; your statutory data-protection rights are not waived by using an integration.

## 8. Retention and deletion

- **Local app data:** retained until you delete it through the app or operating system. The full-data-wipe option clears app-managed data; separately exported files, originals and external backups require separate deletion. We cannot remotely access or delete a database that exists only on your device.
- **Support:** retained while resolving your request and for no longer than **12 months after the last interaction**, unless a legal obligation or a specific dispute requires limited longer retention. This applies to operator-held form responses, email and copies; deletion is managed by the operator, not by an automatic app timer.
- **Hall of Fame:** retained while your recognition remains published, until you request removal. We remove it from the active list and operator-managed records unless a justified legal retention requirement applies. Previously distributed app versions, public repository history, caches or other people's copies may retain earlier public information.
- **Purchases:** retained as necessary to manage access, restoration and applicable legal obligations; service providers retain their own records under their policies. Removing the app does not cancel purchases or erase store/provider transaction records. Contact us to request deletion of data we control, subject to lawful exceptions.
- **Hosting and external services:** retention is governed by the relevant provider and the purpose of its processing. We do not promise that clearing local app data deletes third-party records.

## 9. Your choices and rights

You can disable Discord, stop casting, manage app permissions, clear local data and browser storage, and request removal of your public alias. To request access, correction, erasure, restriction, portability or objection where applicable, or to withdraw consent, email [pescalerag.dev@gmail.com](mailto:pescalerag.dev@gmail.com). Explain your request and the relevant alias, support conversation or purchase reference; do not send passwords or full payment details. We request proportionate identity information only when needed.

We respond within the applicable legal period, normally one month; any lawful extension and its reason will be communicated. You can complain to the [Spanish Data Protection Agency (AEPD)](https://www.aepd.es) or your competent supervisory authority. Withdrawal of consent does not affect processing already lawfully carried out.

## 10. Changes and contact

The date at the top identifies the latest version. Material changes will be described on this website and, where required, communicated or presented for renewed consent before the relevant processing. Contact: [pescalerag.dev@gmail.com](mailto:pescalerag.dev@gmail.com). See also the [Terms of Use](https://mmplayer.pescalerag.com/terms).
