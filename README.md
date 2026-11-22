# Tap Link

Tap Link is a standalone browser website for classroom attendance.

## Run the app

1. Install Node.js.
2. Run `npm start`.
3. Open `http://localhost:3000` on this computer.

No npm dependencies or build step are required.

## Demo flow

- Sign in as a student or teacher using the demo role selector. Accounts are demo accounts stored in browser local storage.
- Students choose a subject and check their browser location. If they are inside the geofence, they are marked present automatically. They can also mark themselves present manually.
- Teachers select a section and subject, then mark each student present or absent.
- Attendance is held in browser memory. Subjects and section names are stored in local storage.

## GPS setup

The `GEOFENCE` in `app.js` is set to the USTP CDO main-campus map point (latitude `8.4860705`, longitude `124.656805`, 200 m radius). The point was resolved from [OpenStreetMap contributors](https://www.openstreetmap.org/?mlat=8.4860705&mlon=124.656805#map=18/8.4860705/124.656805); verify the pin and test the boundary on site before relying on attendance records. GPS can be less accurate indoors.

Browser geolocation requires HTTPS when hosted on the public internet. Localhost and a typical local-network HTTP page may vary by browser.
