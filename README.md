# DiscoVR

DiscoVR is a prototype of a virtual reality memory palace built with [Babylon.js](https://github.com/BabylonJS/Babylon.js) and [WebVR](https://webvr.info/).

## Background

A common tool to power one's memory is called the "method of loci". The method of loci (Latin for "places") is a mnemonic device that leverages the brain's powerful spatial memory [^fn1]. In other words, it is a way of remembering things by using a familiar location, such as one's home or hometown.

While many have mastered this technique, preliminary research finds that there are others who have difficulty reusing the same location for different memories. For example, if someone uses their home as a loci, or "memory palace", for a speech on penguins (or butterflies or pull requests...), there have been instances where they will have difficulty using the same location for another speech.

## Solution

DiscoVR aims to solve this issue by creating a virtual reality palace that is infinitely expandable as well as perfectly consistent between accesses. Instead of relying on the brain's faulty memory mechanisms, DiscoVR uses bits and bytes to store a memory palace permanently.

Because DiscoVR can be manipulated by the will of the user, it establishes the same familiarity that one's home may have while also being unlimited in size. It can be accessed remotely, and grows with the amount of information given.

## Technologies

As DiscoVR is only a prototype in its current state, it leverages [Babylon.js](https://github.com/BabylonJS/Babylon.js) as a layer between WebGL and DiscoVR. [WebVR](https://webvr.info/) facilitates the communication between the virtual reality device and DiscoVR itself, and is also the source of different virtual reality lenses.

## Useful Links

* [Macunx VR](https://linguisticator.com/macunx-vr/) is a tool that tried solving this problem, and was found after DiscoVR's initial prototype.

## References

[^fn1]: Qureshi, A., Rizvi, F., Syed, A., Shahid, A., & Manzoor, H. (2014). The method of loci as a mnemonic device to facilitate learning in endocrinology leads to improvement in student performance as measured by assessments. Advances in Physiology Education, 38(2), 140–144. http://doi.org/10.1152/advan.00092.2013

