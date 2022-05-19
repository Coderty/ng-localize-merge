## What is?

Angular 13 translations message file merge utility.

## Installation

```bash
npm install -g ng-localize-merge
```

## Usage

```bash
ng-localize-merge --help
```

To use the translation function you must specify the google "Cloud Translation" API key in the `GOOGLE_TRANSLATE_CREDENTIALS` environment variable (you can do this in an .env file) or by specifying the key in the `--google-api-key` (-g) argument.

Sample
```bash
ng-localize-merge -t -g YOUR_GOOGLE_API_KEY_HERE
```
