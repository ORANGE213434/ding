# Ding Chat

A chat website where you message friends and make group chats. It has:

- Accounts with email, username and password (passwords are hashed with bcrypt)
- Log in with your email or username, log out, and change your password (changing it logs out your other devices)
- Friend requests: you can only chat with someone after they accept
- Direct messages and group chats. Anyone in a group can rename it; only the group leader can add or kick members
- Photos: send, draw on, add text, crop, rotate, flip and adjust before sending; re-edit your own photos or edit someone else's and send it back
- Replies, editing and deleting your own messages
- Verified badges: the owner (the account with username **YoOrange**) is always verified and can give or remove the badge on anyone's profile
- Moderation: ranks of Owner > Senior mod > Mod > user. Mods can warn and ban (for minutes, hours, days, weeks, or forever) anyone ranked below them
- Reports: anyone can report a user or a message; mods review them in the moderation panel
- A "ding" sound whenever a message or friend request arrives
- Live updates through WebSockets (Socket.IO)

Everything, including photos, is stored in PostgreSQL, so nothing is lost when the server restarts.

## Put it on Render

1. Make a new repository on GitHub and upload everything in this folder to it (the `node_modules` folder is not needed).
2. Sign in at https://render.com and connect your GitHub account.
3. Click **New → Blueprint**, pick your repository, and click **Apply**.
   Render reads `render.yaml` and creates two things: the `ding-chat` web service and the `ding-db` PostgreSQL database. It also makes a random `JWT_SECRET` for you.
   **Sign up as `YoOrange` straight away.** Whoever owns the username YoOrange is the owner, so claim it before anyone else can.
4. Wait for the deploy to finish, then open the `.onrender.com` link shown on the `ding-chat` service. Sign up, and send the link to your friends.

### Things to know about Render's free plan

- A free web service goes to sleep after 15 minutes with no visitors. The next visit takes about a minute to wake it up. Paid instances don't sleep.
- **A free Render database expires 30 days after it's created.** After that you get a 14-day grace period to upgrade it to a paid plan, and then it is deleted along with all accounts and messages. Upgrade the database (in the Render dashboard) if you want to keep your chats.
- A free database holds 1 GB. Photos are shrunk to at most 1600 px before upload, so that is room for a few thousand photos.

## Run it on your own computer

You need Node.js 18 or newer and a PostgreSQL database.

```bash
npm install
DATABASE_URL=postgres://user:password@localhost:5432/ding JWT_SECRET=any-long-random-text npm start
```

Then open http://localhost:3000. The tables are created automatically on first start.

## Settings (environment variables)

| Name | What it does |
| --- | --- |
| `DATABASE_URL` | PostgreSQL connection string. Required. |
| `JWT_SECRET` | Secret used to sign login sessions. Set a long random value; if missing, everyone is logged out on each restart. |
| `OWNER_USERNAME` | Username of the owner account. Defaults to `yoorange` (usernames aren't case-sensitive, so this is YoOrange). The owner always has a verified badge and is the only one who can give badges out. |
| `OWNER_EMAIL` | Optional: also make the account with this email an owner. |
| `PGSSL` | Set to `true` if your database needs SSL (for example Render's *external* database URL). Not needed with the Blueprint. |
| `PORT` | Port to listen on. Render sets this for you. |
| `NODE_ENV` | Set to `production` so login cookies are HTTPS-only. |

## Verified badges

Sign up with the username `YoOrange`. You'll see a gold badge next to your name and an Owner note in your settings.
To verify someone, open their profile (tap their name in the Friends tab or a search result, tap a group member, or use the info button in a chat) and press **Give verified badge**. Press **Remove verified badge** to take it away. Verified people get a blue badge next to their name everywhere in the app.

## Moderation

| Rank | Can do |
| --- | --- |
| **Owner** (YoOrange) | Everything below, plus make or remove senior mods and give verified badges |
| **Senior mod** | Make people mods or remove mods, plus everything a mod can do |
| **Mod** | Warn and ban people, see and handle reports |
| User | Report users and messages |

Anyone can only act on people ranked **below** them, so a mod can't ban a senior mod and nobody can ban the owner.

- **Change someone's rank:** open their profile. The owner gets a Role menu; senior mods get a Make mod / Remove mod button.
- **Warn:** open their profile, type a reason and press Warn. They get a ding and a pop-up straight away (or the next time they log in) and have to press "I understand".
- **Ban:** open their profile, pick a length (minutes, hours, days, weeks, or Permanent), type a reason and press Ban. They're logged out immediately and see the reason and when the ban ends. Bans lift on their own when the time is up, or a mod can press **Unban now**.
- **Reporting with evidence:** the report form lists the person's recent messages and photos from chats you share with them. Tick up to 10 to attach. Reporting straight from a message ticks that one for you. Attached messages are copied into the report, so they stay as evidence even if the sender edits or deletes them.
- **Viewing the chat:** each attached message has a **View chat** button that opens that conversation (read-only) around the reported message, with reported messages highlighted. Mods can only open chats that are attached to a report. Messages the sender deleted are shown to mods, marked "deleted by sender"; regular users still can't see them.
- **Reports:** the shield button at the top of the sidebar opens the moderation panel (it shows a number when reports are waiting). Each report shows who was reported, why, the reported message or photo, and buttons to open their profile, mark it handled, or dismiss it. The **Bans** tab lists everyone currently banned.
- People don't find out who reported them.

## Not included

- "Forgot password" by email. That needs an email-sending service (such as Resend or SendGrid). Until then, a user who forgets their password needs a new account, or you can reset it in the database.
- End-to-end encryption. Messages are private to the people in each chat, but whoever runs the server and database can read them.

## Files

- `server.js`: the server (accounts, friends, chats, messages, photos, live updates)
- `public/index.html`, `public/app.js`: the website
- `render.yaml`: the Render Blueprint
