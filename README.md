<p align="center">
  ➡️
  <a href="#installation">Installation</a> |
  <a href="#quick-start">Quick Start</a> |
  <a href="#options">Configuration</a> 
  ⬅️
  <br /><br />
  <img src="docs/images/gtfs-accessibility-validator-logo.svg" alt="GTFS accessibility Validator" />
  <br /><br />
  <a href="https://www.npmjs.com/package/gtfs-accessibility-validator" rel="nofollow"><img src="https://img.shields.io/npm/v/gtfs-accessibility-validator.svg?style=flat" style="max-width: 100%;"></a>
  <a href="https://www.npmjs.com/package/gtfs-accessibility-validator" rel="nofollow"><img src="https://img.shields.io/npm/dm/gtfs-accessibility-validator.svg?style=flat" style="max-width: 100%;"></a>
  <img src="https://img.shields.io/badge/License-MIT-yellow.svg">
  <br /><br />
Validate GTFS transit data accessibility fields
  <br /><br />
  <a href="https://nodei.co/npm/gtfs-accessibility-validator/" rel="nofollow"><img src="https://nodei.co/npm/gtfs-accessibility-validator.png?downloads=true" alt="NPM" style="max-width: 100%;"></a>
</p>

<hr>

`gtfs-accessibility-validator` checks transit data in [GTFS format](https://developers.google.com/transit/gtfs/) for fields and files related to accessibility.

It checks for:

* `wheelchair_accessible` field in `trips.txt`
* `wheelchair_boarding` field in `stops.txt`
* `tts_stop_name` field in `stops.txt`
* `levels.txt` file
* `pathways.txt` file
* Contrast level between `route_color` and `route_text_color` in `routes.txt`

These accessibility guidelines are taken from the [California Transit Data Guidelines](https://dot.ca.gov/cal-itp/california-transit-data-guidelines-v3_0#section-checklist) published by Caltrans.

### `wheelchair_accessible` field in `trips.txt`
**Guideline:** The wheelchair_boarding field has a valid, non-empty, and non-null value for every entry in the stops.txt file.

Transit riders with wheelchairs and other mobility aids encounter distinct challenges in accessing transit, including uncertainty as to whether they can board and alight at particular locations using their devices.

Transit providers should support the ability of these riders to plan and take trips on transit by publishing information about the locations where wheelchair users can and cannot access the system in trip-planning applications.

### `wheelchair_boarding` field in `stops.txt`
**Guideline:** The wheelchair_accessible field has a valid, non-empty, and non-null value for every entry in the trips.txt file.

Transit riders with wheelchairs and other mobility aids encounter distinct challenges in accessing transit, including the uncertainty as to whether their devices can be used on specific scheduled trips.


Transit providers should support the ability of these riders to plan and take trips on transit by publishing information about the trips on which wheelchair users may or may not be able to travel in trip-planning applications.

### `tts_stop_name` field in `stops.txt`
**Guideline:** The tts_stop_name field should include correct pronunciation for all stop names in stops.txt that are commonly mispronounced in trip-planning applications.

Audio annunciation of stop names is an important wayfinding tool for transit riders with visual impairments.

Transit providers should support the ability of these riders to conveniently and accurately plan and take trips on transit by ensuring that stop names will be pronounced correctly in trip-planning applications.

BlinkTag created a different open source tool to review GTFS stop name pronunciations and determine which stops need a tts_stop_name value. [See GTFS Text-to-Speech Tester](https://github.com/BlinkTagInc/gtfs-tts).

### `levels.txt` and `pathways.txt` files
**Guideline:** Sufficient data is included within stops.txt, pathways.txt, and levels.txt to navigate to, from, and between any boarding zone to street level with varying physical abilities, including pathway_mode and stair_count where applicable. This includes but is not limited to any stops that use parent_station in stops.txt as well as all significant or named transit facilities where an infrequent visitor may be concerned about accessibility.

Transit riders with wheelchairs and other mobility aids encounter distinct challenges in accessing transit, including uncertainty about navigating between boarding zones and street level at stops.

Transit providers should support the ability of these riders to plan and take trips on transit by providing sufficient information for them to find accessible paths on and off transit using mobile applications.

### Contrast level between `route_color` and `route_text_color` in `routes.txt`
**Guideline:** WCAG AA Large Text Contrast

Routes are often identified using the `route_color` field in routes.txt.  Often, the route_short_name is used as text on top of the `route_color` using the `route_text_color`.

## Installation

If you would like to use this library as a command-line utility, you can install it globally directly from [npm](https://npmjs.org):

    npm install gtfs-accessibility-validator -g

Or you can use it directly via npx:

    npx gtfs-accessibility-validator --gtfsUrl https://agency.com/gtfs.zip

If you are using this as a node module as part of an application, you can include it in your project's `package.json` file.

## Quick Start

### Command-line example

Run via npx:

    npx gtfs-accessibility-validator --gtfsPath /path/to/your/gtfs

    npx gtfs-accessibility-validator --gtfsUrl https://agency.com/gtfs.zip

If installed globally:

    gtfs-accessibility-validator --gtfsPath /path/to/your/gtfs

    gtfs-accessibility-validator --gtfsUrl https://agency.com/gtfs.zip

### Code example

```js
import gtfsAccessibilityChecker from 'gtfs-accessibility-checker';

const config = {
  gtfsPath: '/path/to/gtfs'
}

gtfsAccessibilityChecker(config)
  .then((outputStatus) => {
    console.log(outputStats);
  })
  .catch((err) => {
    console.error(err);
  });
```

## Running

To validate GTFS accessibility, run `gtfs-accessibility-validator`.

    gtfs-accessibility-validator --gtfsPath /path/to/your/gtfs.zip

### Options

`gtfsPath`

Specify a local path to GTFS, either zipped or unzipped.

    gtfs-accessibility-validator --gtfsPath /path/to/your/gtfs.zip

or

    gtfs-accessibility-validator --gtfsPath /path/to/your/unzipped/gtfs

`gtfsUrl`

Specify a URL to a zipped GTFS file.

    gtfs-accessibility-validator --gtfsUrl http://www.bart.gov/dev/schedules/google_transit.zip

`skipImport`

Skips importing GTFS into SQLite. Useful if you are rerunning with an unchanged GTFS file. If you use this option and the GTFS file hasn't been imported or you don't have an `sqlitePath` to a non-in-memory database, you'll get an error.

    gtfs-accessibility-validator --skipImport

## Contributing

Pull requests are welcome, as is feedback and [reporting issues](https://github.com/BlinkTagInc/gtfs-accessibilty-validator/issues).
