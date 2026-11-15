# Haste

Sharing code is a good thing, and it should be _really_ easy to do it.
A lot of times, I want to show you something I'm seeing - and that's where we
use pastebins.

Haste is the prettiest, easiest to use pastebin ever made.

## Basic Usage

Type what you want me to see, click "Save", and then copy the URL.  Send that
URL to someone and they'll see what you see.

To make a new entry, click "New" (or type 'control + n')

## From the Console

Most of the time I want to show you some text, it's coming from my current
console session.  We should make it really easy to take code from the console
and send it to people.

`cat something | haste` # https://hastebin.example.com/1238193

You can even take this a step further, and cut out the last step of copying the
URL with:

* macOS: `cat something | haste | pbcopy`
* Linux: `cat something | haste | xsel -b`
* Windows: check out [WinHaste](https://github.com/ajryan/WinHaste)

After running that, the STDOUT output of `cat something` will show up at a URL
which has been conveniently copied to your clipboard.

That's all there is to that, and you can install it with `gem install haste`
right now.
  * macOS: you will need to have an up to date version of Xcode
  * Linux: you will need to have rubygems and ruby-devel installed

## Duration

Pastes will stay for 30 days from their last view.  They may be removed earlier
and without notice.

## Privacy

While the contents of Haste are not directly crawled by any search robot
that obeys `robots.txt`, there should be no great expectation of privacy.  Post
things at your own risk. Not responsible for any loss of data or removed
pastes.

## Open Source

Haste can easily be installed behind your network, and it's all open source!

* [haste-client](https://github.com/C0rn3j/haste-client)
* [haste-server](https://github.com/C0rn3j/haste-server)

## Author

Code by Martin Rys <rys.rs/contact>
Original code by John Crepezzi <john.crepezzi@gmail.com>
Key Design by Brian Dawson <bridawson@gmail.com>
