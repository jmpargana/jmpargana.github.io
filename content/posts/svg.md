+++
title = 'SVG: `viewBox`'
date = 2024-08-26T17:11:59+01:00
draft = false
tags = ["frontend", "html", "svg", "css"]
+++

In this post, I'll explore the `viewBox` attribute in the `<svg>` HTML tag. I'll use examples from the [MDN documentation](https://developer.mozilla.org/en-US/), applied to SVGs on this website's home page.

## Introduction

Before starting, it's worth noting that SVGs are an extremely rich feature deserving extensive reading. The [MDN documentation](https://developer.mozilla.org/en-US/docs/Web/SVG) does an incredible job providing both [Tutorials](https://developer.mozilla.org/en-US/docs/Web/SVG/Tutorials/SVG_from_scratch) and [Guides](https://developer.mozilla.org/en-US/docs/Web/SVG/Guides) covering all attributes and features you'll need to create and use SVGs.

With that said, we can move on into how to display it.

## Embedding

SVGs are written in markup and can be embedded in XML, HTML, inside an `<img>` tag as static content, in an `<iframe>`, or referenced as an `<object>`.

Choosing between these options involves weighing pros and cons. I'll focus on rendering as an HTML tag versus loading as a static image.

### Static Image

**Pros:**
- Clean HTML
- Cacheable

**Cons:**
- Limited access:
  - Can't change colors of particular elements (lines, shapes)
  - Can't have full control of elements during animations

### HTML Tag

**Pros:**
- Full control
- Easy to debug and understand contents

**Cons:**
- Larger HTML
- No caching


Since this site requires mirroring, flipping, scaling, and animating SVGs, I chose the HTML tag approach despite the HTML size impact.


## `viewBox`

If you experiment with an SVG from sites like [Undraw](https://undraw.co/), [Freepik](https://www.freepik.com/), or your favorite icon library, you'll probably notice a `viewBox` attribute like `viewBox="0 0 500 500"`.

The documentation says:

> _"The `viewBox` attribute is a list of four numbers separated by whitespace or comma: min-x, min-y, width, and height."_

I find this explanation confusing for these reasons:
- `min-x` and `min-y` are coordinates, not lengths
- `width` and `height` are also available as separate attributes... what gives?!


### Canvas

Think of an SVG as a canvas. The values in `viewBox` are the top-left and bottom-right points of your canvas window.

The numbers don't matter much because SVGs are _Scalable_—meaning the coordinates could be pixels, centimeters, etc., determined by other factors (like `width` or `height`). By default, one unit matches one pixel in your viewport.

These coordinates only matter if the content inside has **its own** coordinates. For example:

```html
<svg viewBox="0 0 10 10" xmlns="http://www.w3.org/2000/svg">
  <rect x="2" y="2" width="100%" height="100%" />
  <circle cx="50%" cy="50%" r="4" fill="white" />
</svg>
```

![original](/images/svg/starting-svg.png)

You can see that the rectangle starts 2/10ths from the top and left corner. If I change the `viewBox="2 2 10 10"`, the rectangle now starts at the top of the canvas. If instead I set `viewBox="6 6 10 10"`, I see the rectangle's end and starting point in its middle. In conclusion, the first 2 values define the window location into what's inside the canvas.

![original](/images/svg/centered-svg.png)

![original](/images/svg/shifted-svg.png)


Now let's explore changing the second pair of values. Setting `viewBox="0 0 30 30"`. You'll notice the coordinates don't actually change; instead you zoom. Notice the zoom differs for the rectangle and circle. That's because the circle now has a radius of 2/30 instead of the original 2/10. If you change to `viewBox="6 6 30 30"`, the rectangle still closes in the same location.

![original](/images/svg/zoomed-svg.png)

You have 2 different behaviors. Objects with absolute configuration like `r="2"` will show canvas zooming. Objects without absolute configuration won't change. __Relative content adapts; absolute content stays unchanged (window adapts).__

### Fixed dimensions

Now let's see how setting fixed `height` and `width` impacts the changes above.

```html
<svg height="100" width="100" viewBox="0 0 10 10" xmlns="http://www.w3.org/2000/svg">
  <rect x="2" y="2" width="100%" height="100%" />
  <circle cx="50%" cy="50%" r="4" fill="white" />
</svg>
```

![original](/images/svg/scaled-svg.png)


The first thing you'll notice is the SVG is tiny. Setting fixed values for the window means the default 1 unit to 1px has changed to 1 unit to 0.1px (10/100).

Changing the first and second pair shows the same behavior as before, only with the SVG _scaled_ to a different dimension.

### Recipe

If you're working with SVGs on your website, here's the recipe I'd follow:
1. Define output box dimensions via `height` and `width` to set the correct SVG scale
2. Adapt the coordinates for the object
3. Scale the inner content inside the canvas (if applicable)


## Conclusion

I hope this clarified some doubts about SVGs. My suggestion for learning how such tools work is to simply experiment. The [MDN playground](https://developer.mozilla.org/en-US/play?uuid=ca097dc9-6900-46a5-a5a4-8d506f18a607&state=1VLLasMwEPyVRRBoIY7VRy6qm0O%2BwxdHVq1NZcnIixUT8u9d2aG99AcCEjO70uwwsFdhqXdCiWqcOpjQpGO4fNZCgoQXudxawKV3fuSuJRpUWaaUdultF2JXvkopS5bW4lB7gCoaTbAMYNl8x4QtWeY8bMOlNdhZ%2BqvLVaoxamdAZ%2FV%2BedDzL43M3hm%2F0DmmySKZu7TK%2FozM%2FsvA52ETFHvg81AZxFboceSFynu1rf0ptDNDznXNBqutyou1%2BciNyURC3biicdh5BRQG7t8WifKBnlQMgZ5XdYvj4JpZAXqH3hQnF%2FT3%2Bp2Nz9mXkazpDVOXrcTtBw%3D%3D&srcPrefix=%2Fen-US%2Fdocs%2FWeb%2FSVG%2FReference%2FAttribute%2FviewBox%2F) is a great place to start.
