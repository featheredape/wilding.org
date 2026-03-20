/* ══════════════════════════════════════════
   The Wilding Foundation — Shared JS
   ══════════════════════════════════════════ */

(function () {
    "use strict";

    // Navbar scroll shadow
    var navbar = document.getElementById("navbar");
    if (navbar) {
        window.addEventListener("scroll", function () {
            navbar.classList.toggle("scrolled", window.scrollY > 10);
        });
    }

    // Home link reveal on index page (hidden until user scrolls past hero)
    var navHome = document.getElementById("navHome");
    var heroSection = document.getElementById("hero");
    if (navHome && heroSection) {
        window.addEventListener("scroll", function () {
            var heroBottom = heroSection.offsetTop + heroSection.offsetHeight;
            navHome.classList.toggle("hidden", window.scrollY < heroBottom - 40);
        });
    }

    // Mobile menu toggle
    var navToggle = document.getElementById("navToggle");
    var navLinks = document.getElementById("navLinks");
    if (navToggle && navLinks) {
        navToggle.addEventListener("click", function () {
            navLinks.classList.toggle("open");
        });
        navLinks.querySelectorAll("a").forEach(function (link) {
            link.addEventListener("click", function () {
                navLinks.classList.remove("open");
            });
        });
    }

    // Scroll-triggered fade-in
    var observer = new IntersectionObserver(
        function (entries) {
            entries.forEach(function (entry) {
                if (entry.isIntersecting) {
                    entry.target.classList.add("visible");
                }
            });
        },
        { threshold: 0.15 }
    );
    document.querySelectorAll(".fade-in").forEach(function (el) {
        observer.observe(el);
    });
})();
