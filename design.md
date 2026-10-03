I want to build a simple local static website to share the pictures and route of a trip.

The layout will be divided into 2 parts: the left half will be the images of a "spot". the right half will show the location of that spot on the map. by default, it should also shows the path from the last spot to the current spot. there will be a slider & navigation at the bottom to switch between spots.

The spots will be ordered and grouped into days. Before each day's full view, show a full screen map of the route of that day, with numbers on the map to indicate the order of the spots.

So the json structure will be something like:
```json
[
  {
    "trip": "Iceland",
    "itinerary": {
      "date": "2026-10-01",
      "spots": [
        {
          "name": "Spot 1",
          "lat": 34.0522,
          "lng": -118.2437,
          "images": ["image1.jpg", "image2.jpg"],
          "show_previous_route": false
        },
        {
          "name": "Spot 2",
          "lat": 34.0522,
          "lng": -118.2437,
          "images": ["image1.jpg", "image2.jpg"],
          "show_previous_route": true
        }
      ]
    }
  }
]
```

Notes:
- Use https://mui.com/material-ui?
- i want the route between spots be the driving route (navigation), not just straight lines connecting the spots.
- i want the very first page be a map of the overview of the entire trip's route, with different colors for different days

You can construct the example data from the pictures in `assets/iceland/`.

Consider using https://visgl.github.io/react-google-maps/ for map stuff