# Hush

## What my app does
Hush is a mobile-friendly web app for people with hidden illnesses. Based on the current code, users can sign in locally, complete onboarding, track environmental trigger factors (Noise, Light, Chemicals, Crowds, UV, Air Quality, Temperature, Pollen), search places, view map overlays/heatmaps, get route navigation, and log personal events directly on the map.

## API used (with links)
Based on the current implementation:
- Open-Meteo API (weather): https://open-meteo.com
- OpenStreetMap Nominatim (geocoding/search): https://nominatim.openstreetmap.org
- OSRM (routing): https://router.project-osrm.org
- NOAA weather alerts: https://api.weather.gov
- USGS Earthquake API (event signals): https://earthquake.usgs.gov/fdsnws/event/1/
- Wikipedia REST API (illness/event context): https://en.wikipedia.org/api/rest_v1/

## Link to live site
https://davina-li-01.github.io/hush/

## Screenshot
![Hush app screenshot](./screenshot.png)

## What I learned about working with APIs

Mini Project #3: API Powered App

Milestone 1: 
What does the API response look like?
 },
    },
    uv: {
      value: weather.uv_index,
      unit: "",
      label: "UV Index",
      icon: "☀️",
      getStatus: (v) => {
        if (v <= 2) return { text: "Low", class: "status-good" };
        if (v <= 5) return { text: "Moderate", class: "status-moderate" };
        return { text: "High", class: "status-bad" };
      },
    },
What fields did you use?

From Weather:

main.temp → temperature
main.humidity → humidity
weather[0].description → condition (e.g., cloudy)
wind.speed → wind

From Air Quality:

main.aqi → overall air quality index
components.pm2_5 → important for respiratory sensitivity
components.o3 → relevant for some conditions

What was the trickiest part of getting fetch to work?

The trickiest part of getting fetch to work was handling asynch data properly, since I wanted to make sure the app didn’t try to use the API data before it had finished loading. AI utilized await, proper JSON parsing, and safe checks to avoid undefined errors.

If AI helped, what did it explain about async/await?

AI explained that async/await allows asynchronous code to be written in a more synchronous and readable way by pausing execution until a Promise resolves, which makes it easier to manage API calls compared to chaining .then() methods.

# Milestone 2: Learning Log

1) How user input was connected to API calls
User input from text fields and buttons is read in JavaScript, then used to build API requests.

When a user types a destination and taps search, the app sends that text to a geocoding API to get coordinates.

When a user taps “Start Navigation,” the app uses current location + destination coordinates to request a route.

Weather data is fetched from Open-Meteo and shown in the Conditions screen.

Illness selection is used to fetch related info and auto-select likely trigger filters.

Inputs are handled with event listeners (onclick, oninput, Enter key), and API calls use fetch() with async/await.

2) What CSS layout was used for displaying data

- A mobile-first layout was used with CSS Grid and Flexbox.
- Main app shell uses grid rows: header, content area, bottom navigation.
- Map view is stacked: search/actions at top, map in the middle, filters below.
- Cards are used for route preview, conditions, logs, and profile details.
- Buttons and pills use consistent spacing, height, and rounded corners.
- Overlays (modal, drawer, toast, navigation card) use fixed/absolute positioning for quick interactions.

3) Design decisions made

- The main design goal was to make it feel like a navigation app while keeping the existing features.
- Search and navigation actions were made more prominent at the top of the map.
- A slide-out drawer was added for hamburger menu usability.
- Emoji icons were replaced with a consistent icon style.
- Filters were moved into a clearer “Environmental Filters” section.
- Large persistent helper boxes were removed and replaced with lighter toasts.
- Live navigation feedback was improved (route preview, active nav overlay, live follow/- reroute). 
- Styling stayed in the purple theme, but contrast, spacing, and hierarchy were improved for readability on mobile.

Milestone 3:

# What extension did you add?

I added a Favorites feature so users can save locations they search for and quickly go back to them from the Logs tab. I also added a star button on each logged event so you can mark ones that are important and filter to only see those. On top of that I added a detail view so when you tap an event it shows a popup with more info like the time, location, and factor.

# What edge cases did you handle?

I handled what happens when someone searches for something that doesn't exist — before it just did nothing, now it shows "No results found. Try a different location." I also fixed the empty logs page to have a button that takes you to the map instead of just saying nothing is there. And if the weather API fails it now shows a small banner at the top instead of breaking the whole page.

# What surprised you about working with a real API?

I was surprised by how inaccurate the route times were at first. The app was showing 72 minutes for a trip that should take way less, because I was calculating the distance in a straight line instead of using the actual route data. Once I switched to using the real OSRM response the times made a lot more sense. I also didn't realize how differently each API fails — some give you an empty array, some just don't respond, so I had to add error handling everywhere instead of just in one place.