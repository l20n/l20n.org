---
category: learn
layout: learn
title: "Globals: @screen"
prev_section: globals-os
prev_title: "Globals: @os"
next_section: entities-public-vs-local
next_title: "Entities: public vs. local"
---

<section class="clearfix">
  <div class="left">
    <p>In localization, English is mostly used as a source language. Being much shorter than many target languages, the same amount of screen space that is available for a developer in English, will not neccessarily be enough for localizers.</p>
    <p>L20n tackles this issue with the concept of responsive localization. It enables us to use different translations on different devices and different device orientations.</p>
    <p>In the example, we use translations with different lengths on different screen widths. The <code>isWide($n)</code> macro takes <code>@screen.width</code> as an argument and returns the appropriate index.</p>
  </div>
  <div class="right">
    <div class="editor sourceEditor height15"
      id="sourceEditor1"
      data-source="sourceEditor1"
      data-output="output1"
    >&lt;isWide($n) { $n.px &gt; 1200 ? "large" :
        $n.px &gt; 980 ? "desktop" :
          $n.px &gt; 768 ? "landscapeTablet" : 
            $n.px &gt; 480 ? "landscapePhone" : 
              "portraitPhone" }&gt;
&lt;dataSettings[isWide(@screen.width)] {
 *wide: "Data Connectivity Settings",
  landscapePhone: "Data Settings",
  portraitPhone: "Data"
}&gt;
    </div>
    <dl id="output1">
    </dl>
  </div>
</section>
