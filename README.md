Portfolio Project

Installation and Local Development

1. Clone the repository
git clone https://github.com/YOUR_USERNAME/YOUR_REPO.git
cd YOUR_REPO
2. Install dependencies
npm install
3. Run the development server
npm run dev

The application will be available at:
http://localhost:5173

Build
To create a production build:

npm run build

The output will be generated in the dist directory.

Deployment (Netlify)

Option 1: Manual deployment
Go to Netlify
Drag and drop the dist folder into the dashboard
The site will be published automatically

Option 2: Git-based deployment
Push the project to GitHub
Connect the repository in Netlify
Use the following settings:

Build command:
npm run build

Publish directory:
dist

Updating the Project (Git)
Add changes:

git add .

Create a commit:

git commit -m "update: describe changes"

Push to repository:

git push

Setting Remote Repository (if not configured)

git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO.git
git branch -M main
git push -u origin main
Git Status Check
git status

Form Handling (Formspree)

The contact form uses Formspree as a backend.

Make sure:

The form endpoint is correctly configured
The form is activated via email confirmation

Example endpoint:

https://formspree.io/f/your_id

Useful Commands

Reinstall dependencies:

rm -rf node_modules
npm install

Restart development server:

npm run dev

Tech Stack

React
Vite
Tailwind CSS
Framer Motion

Contacts

GitHub: https://github.com/stewe-snowwhite
Telegram: https://t.me/stewe_snowwhite
