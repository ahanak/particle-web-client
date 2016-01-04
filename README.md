# Particle Web Client #

The Particle Web Client is a graphical user interface (GUI) to access the particle cloud.
The program can be used to access variables, functions and events of your devices from particle.
One use case is to test your device firmware while the client application does not yet exist.
It is written in JavaScript and runs completely in the browser. Nothing requires the execution on a server.

You can easily use the application by opening https://particle.a-hanak.de in your browser.

Screenshots can be found at https://www.a-hanak.de/gallery/ParticleWebClient.

## Run Your Own Copy ##

If you want to run your own copy of the program, do the following:

- Download the project
  - either as archive from https://github.com/ahanak/particle-web-client/archive/master.zip
  - or via `git clone https://github.com/ahanak/particle-web-client.git` command.
- Open index.html in your favorite browser

## Features ##

The most important features are:
- runs on most devices because of its design as web application
- no transmission of application data to the webserver hosting hosting the application
- no code execution on the webserver
- listing of devices in the particle cloud
- calling of functions on particle devices
- query values of variable on the particle devices
- listing events
- publishing events

## Planned Features ##

The following features might be implemented sometimes.

- PhoneGap support to generate apps for Android, iPhone, Windows Phone etc.
- support for plugins to allow the creation of custom user interfaces for particle applications
- example plugin for tinker
