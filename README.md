# SafeTradie

Free pre-start check and SWMS builder for electricians, plumbers/gasfitters and carpenters working on **residential** jobs (houses, units, townhouses). Not designed for commercial, industrial or large construction sites.

Part of the InstallHub suite (lives at safetradie.installhub.org). Forked from SafeInstall. Static site: a single `index.html`, deployed by Netlify from the `main` branch. No build step.

Email sending: `netlify/functions/send.mjs` via Resend. Set `RESEND_API_KEY` and `MAIL_FROM` (e.g. `SafeTradie <noreply@yourdomain>`) in Netlify; the sending domain must be verified in Resend.

A free guidance tool only. Users are responsible for their own safety, licensing and legal compliance.
