# Film Recipe Note v6

## Background

- Photo background: Select an image using the **Background** button at the top.
- Solid-color background: Select a color using the **Default** button at the top.
- Available colors:
  - `#FFFFFF`
  - `#F5F5F7`
  - `#DCE4DE`
  - `#1D2A3A`
  - `#121212`
  - `#FFECF1`
  - `#FFF9E6`
  - `#040720`
- The default background color is `#121212`.
- When a light background is selected, the landing-page text automatically switches to a darker color.

## Recipe Setting Order

1. Film Simulation
2. Monochromatic Color
3. Grain Effect
4. Color Chrome Effect
5. Color Chrome FX Blue
6. Smooth Skin Effect
7. White Balance
8. Dynamic Range
9. Tone Curve
10. Color
11. Sharpness
12. High ISO Noise Reduction
13. Clarity
14. Long Exposure Noise Reduction

## Additional Changes

- Removed LMO.
- Replaced all numeric spinner inputs with selection menus.
- ISO options:
  - ISO 125 or higher
  - ISO 250 or higher
  - ISO 500 or higher
- Exposure compensation:
  - `-3` to `+3`
  - Adjustable in 1/3-stop increments
- White Balance Shift:
  - Red and Blue values from `-9` to `+9`
- Direct Kelvin input is available when **Color Temperature** is selected.
- When **Monochrome** or **ACROS** is selected:
  - `STD`, `Ye`, `R`, and `G` filter options are available.
  - `WC` and `MG` values from `-9` to `+9` are displayed.
- For all other film simulations:
  - Monochromatic Color settings display `#N/A`.
  - Monochromatic Color controls are disabled.
- Existing IndexedDB recipes and cover images are preserved.
- Existing field values are automatically migrated to the new structure.

## Backup

The backup file includes:

- All recipes
- Recipe cover images
- The app background image or solid-color background settings

---

## v6.1 Changes

- Added dedicated text-color themes for all eight solid-color backgrounds.
- Light backgrounds now use coordinated dark neutral colors instead of a single black text color.
- Dark backgrounds use cream or blue-gray text colors.
- Landing-page text, header titles, secondary text, and top toolbar buttons automatically adapt to the selected background.
- Recipe Name and Category are arranged in a two-column layout.
- ISO Range and Exposure Compensation are arranged in a two-column layout.
- ISO labels were changed to:
  - ISO 125 or higher
  - ISO 250 or higher
  - ISO 500 or higher
- Color Chrome Effect, Color Chrome FX Blue, and Smooth Skin Effect are arranged in a three-column layout.
- Dynamic Range and Tone Curve are arranged in a two-column layout.
- Color, Sharpness, High ISO Noise Reduction, and Clarity are arranged in a four-column layout.
- All selected values in dropdown menus are center-aligned.
- On narrow screens, label text automatically scales down based on its length.

---

## v6.2 Changes

- Improved category visibility on recipe list cards.
- Added a separate category badge next to each recipe name.
- Category badges automatically scale down on smaller screens.
- Categories can now be identified without opening the recipe.

---

## v6.3 Font Changes

- Korean UI text, descriptions, buttons, and settings:
  - **Spoqa Han Sans Neo**
- English headings, recipe names, categories, and numeric setting values:
  - **Avenir Next**
- Spoqa Han Sans Neo is loaded through a CDN-hosted CSS file.
- Avenir Next uses the built-in Apple system font when available.
- On devices without Avenir Next, the following fallback order is used:
  - Helvetica Neue
  - Helvetica
  - Arial
- Existing layouts, IndexedDB data, cover images, and background settings are preserved.
- The Service Worker cache name was updated to `v6-3`.

### Notes

- Spoqa Han Sans Neo is loaded during the first online visit.
- During the first launch without an internet connection, the device's default Korean system font may be used instead.
- Avenir Next is displayed most accurately on iPhone and Mac devices.

---

## v6.4 App Icon and Name Changes

- Home screen app name:
  - **Film Simulation Note**
- Browser title:
  - **Film Simulation Note**
- Landing-page title:
  - **Film Simulation Note**
- Added a new film-frame app icon.
- Included icon sizes:
  - `180 × 180` for the iPhone home screen
  - `192 × 192` for PWA installation
  - `512 × 512` for PWA installation
  - `1024 × 1024` source image for future use
- The Service Worker cache name was updated to:

```text
film-simulation-note-v6-4
