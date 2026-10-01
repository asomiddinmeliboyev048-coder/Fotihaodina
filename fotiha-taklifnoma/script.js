document.addEventListener("DOMContentLoaded", () => {
    "use strict";

    // ==========================================
    // HELPERS
    // ==========================================

    const $ = (selector) => document.querySelector(selector);
    const $$ = (selector) => document.querySelectorAll(selector);

    // ==========================================
    // LOCAL STORAGE
    // ==========================================

    const RSVP_YES_KEY = "fotiha_rsvp_yes";
    const RSVP_NO_KEY = "fotiha_rsvp_no";
    const WISHES_KEY = "fotiha_wishes";

    function readStorage(key) {
        try {
            const data = localStorage.getItem(key);
            return data ? JSON.parse(data) : [];
        } catch (error) {
            console.error("LocalStorage o'qishda xatolik:", error);
            return [];
        }
    }

    function writeStorage(key, data) {
        try {
            localStorage.setItem(key, JSON.stringify(data));
        } catch (error) {
            console.error("LocalStorage yozishda xatolik:", error);
        }
    }

    // ==========================================
    // TOAST
    // ==========================================

    function showToast(message) {
        const toast = $("#toast");

        if (!toast) return;

        toast.textContent = message;
        toast.classList.add("show");

        clearTimeout(window.toastTimer);

        window.toastTimer = setTimeout(() => {
            toast.classList.remove("show");
        }, 3000);
    }

    // ==========================================
    // ENVELOPE / OPENING
    // ==========================================

    const opening = $("#opening");
    const mainContent = $("#mainContent");
    const openBtn = $("#openBtn");
    const bgMusic = $("#bgMusic");

    if (openBtn) {
        openBtn.addEventListener("click", () => {
            if (opening) {
                opening.classList.add("opened");
            }

            setTimeout(() => {
                if (opening) {
                    opening.classList.add("hidden");
                }

                if (mainContent) {
                    mainContent.classList.add("visible");
                }

                window.scrollTo({
                    top: 0,
                    behavior: "smooth"
                });
            }, 900);

            // Musiqani ishga tushirish
            if (bgMusic) {
                bgMusic.volume = 0.35;

                const playPromise = bgMusic.play();

                if (playPromise !== undefined) {
                    playPromise.catch((error) => {
                        console.log("Musiqa ishga tushmadi:", error);
                    });
                }
            }
        });
    }

    // ==========================================
    // MUSIC BUTTON
    // ==========================================

    const musicBtn = $("#musicBtn");
    const musicText = $("#musicText");

    if (musicBtn && bgMusic) {
        musicBtn.addEventListener("click", () => {
            if (bgMusic.paused) {
                bgMusic.play()
                    .then(() => {
                        musicBtn.classList.add("playing");

                        if (musicText) {
                            musicText.textContent = "Musiqani to'xtatish";
                        }
                    })
                    .catch((error) => {
                        console.log("Musiqa ishga tushmadi:", error);
                        showToast("Musiqa fayli topilmadi.");
                    });
            } else {
                bgMusic.pause();

                musicBtn.classList.remove("playing");

                if (musicText) {
                    musicText.textContent = "Musiqa";
                }
            }
        });
    }

    // ==========================================
    // COUNTDOWN
    // ==========================================

    const eventDate = new Date("2026-10-02T16:00:00+05:00").getTime();

    function updateCountdown() {
        const now = Date.now();
        const difference = eventDate - now;

        const daysElement = $("#days");
        const hoursElement = $("#hours");
        const minutesElement = $("#minutes");
        const secondsElement = $("#seconds");

        if (difference <= 0) {
            if (daysElement) daysElement.textContent = "00";
            if (hoursElement) hoursElement.textContent = "00";
            if (minutesElement) minutesElement.textContent = "00";
            if (secondsElement) secondsElement.textContent = "00";

            return;
        }

        const days = Math.floor(
            difference / (1000 * 60 * 60 * 24)
        );

        const hours = Math.floor(
            (difference / (1000 * 60 * 60)) % 24
        );

        const minutes = Math.floor(
            (difference / (1000 * 60)) % 60
        );

        const seconds = Math.floor(
            (difference / 1000) % 60
        );

        if (daysElement) {
            daysElement.textContent = String(days).padStart(2, "0");
        }

        if (hoursElement) {
            hoursElement.textContent = String(hours).padStart(2, "0");
        }

        if (minutesElement) {
            minutesElement.textContent = String(minutes).padStart(2, "0");
        }

        if (secondsElement) {
            secondsElement.textContent = String(seconds).padStart(2, "0");
        }
    }

    updateCountdown();
    setInterval(updateCountdown, 1000);

    // ==========================================
    // FALLING PETALS
    // ==========================================

    const petalsContainer = $(".petals");

    function createPetal() {
        if (!petalsContainer) return;

        const petal = document.createElement("span");

        petal.className = "petal";

        const size = Math.random() * 10 + 6;
        const left = Math.random() * 100;
        const duration = Math.random() * 6 + 7;
        const delay = Math.random() * 3;

        petal.style.left = `${left}%`;
        petal.style.width = `${size}px`;
        petal.style.height = `${size * 0.65}px`;
        petal.style.animationDuration = `${duration}s`;
        petal.style.animationDelay = `${delay}s`;

        petalsContainer.appendChild(petal);

        setTimeout(() => {
            petal.remove();
        }, (duration + delay) * 1000);
    }

    for (let i = 0; i < 12; i++) {
        setTimeout(createPetal, i * 500);
    }

    setInterval(createPetal, 900);

    // ==========================================
    // GALLERY
    // ==========================================

    const slides = $$(".gallery-slide");
    const dots = $$(".gallery-dot");
    const prevButton = $(".gallery-prev");
    const nextButton = $(".gallery-next");

    let currentSlide = 0;
    let galleryTimer = null;

    function showSlide(index) {
        if (!slides.length) return;

        if (index < 0) {
            index = slides.length - 1;
        }

        if (index >= slides.length) {
            index = 0;
        }

        currentSlide = index;

        slides.forEach((slide, i) => {
            slide.classList.toggle("active", i === currentSlide);
        });

        dots.forEach((dot, i) => {
            dot.classList.toggle("active", i === currentSlide);
        });
    }

    function nextSlide() {
        showSlide(currentSlide + 1);
    }

    function previousSlide() {
        showSlide(currentSlide - 1);
    }

    if (nextButton) {
        nextButton.addEventListener("click", () => {
            nextSlide();
            restartGalleryTimer();
        });
    }

    if (prevButton) {
        prevButton.addEventListener("click", () => {
            previousSlide();
            restartGalleryTimer();
        });
    }

    dots.forEach((dot, index) => {
        dot.addEventListener("click", () => {
            showSlide(index);
            restartGalleryTimer();
        });
    });

    function startGalleryTimer() {
        if (!slides.length) return;

        galleryTimer = setInterval(nextSlide, 5000);
    }

    function restartGalleryTimer() {
        clearInterval(galleryTimer);
        startGalleryTimer();
    }

    showSlide(0);
    startGalleryTimer();

    // ==========================================
    // RSVP
    // ==========================================

    const rsvpForm = $("#rsvpForm");
    const guestName = $("#guestName");

    function normalizeName(name) {
        return name.trim().replace(/\s+/g, " ");
    }

    function updateRsvpCounts() {
        const yesList = readStorage(RSVP_YES_KEY);
        const noList = readStorage(RSVP_NO_KEY);

        const yesCount = $("#yesCount");
        const noCount = $("#noCount");

        if (yesCount) {
            yesCount.textContent = yesList.length;
        }

        if (noCount) {
            noCount.textContent = noList.length;
        }
    }

    if (rsvpForm) {
        rsvpForm.addEventListener("submit", (event) => {
            event.preventDefault();

            const name = guestName
                ? normalizeName(guestName.value)
                : "";

            const submitter = event.submitter;

            if (!name) {
                showToast("Iltimos, ismingizni kiriting.");
                return;
            }

            if (!submitter) {
                showToast("Javob turini tanlang.");
                return;
            }

            const status = submitter.value;

            let yesList = readStorage(RSVP_YES_KEY);
            let noList = readStorage(RSVP_NO_KEY);

            const person = {
                name: name,
                time: new Date().toISOString()
            };

            // Bir xil ismni eski ro'yxatlardan olib tashlash
            yesList = yesList.filter(
                item => item.name.toLowerCase() !== name.toLowerCase()
            );

            noList = noList.filter(
                item => item.name.toLowerCase() !== name.toLowerCase()
            );

            if (status === "yes") {
                yesList.push(person);

                showToast(
                    "Rahmat! Sizni albatta kutamiz. ❤️"
                );
            } else {
                noList.push(person);

                showToast(
                    "Javobingiz uchun rahmat. ❤️"
                );
            }

            writeStorage(RSVP_YES_KEY, yesList);
            writeStorage(RSVP_NO_KEY, noList);

            updateRsvpCounts();

            if (guestName) {
                guestName.value = "";
            }
        });
    }

    updateRsvpCounts();

    // ==========================================
    // RSVP LIST MODAL
    // ==========================================

    const listModal = $("#listModal");
    const modalKicker = $("#modalKicker");
    const modalTitle = $("#modalTitle");
    const modalList = $("#modalList");

    const modalCloseButtons = $$(
        "[data-modal-close]"
    );

    function openListModal(type) {
        if (!listModal || !modalList) return;

        let list = [];

        if (type === "yes") {
            list = readStorage(RSVP_YES_KEY);

            if (modalKicker) {
                modalKicker.textContent = "Tasdiqlanganlar";
            }

            if (modalTitle) {
                modalTitle.textContent = "Albatta boraman";
            }
        } else {
            list = readStorage(RSVP_NO_KEY);

            if (modalKicker) {
                modalKicker.textContent = "Javoblar";
            }

            if (modalTitle) {
                modalTitle.textContent = "Kela olmayman";
            }
        }

        modalList.innerHTML = "";

        if (!list.length) {
            const empty = document.createElement("div");

            empty.className = "modal-empty";
            empty.textContent = "Hozircha ro'yxat bo'sh.";

            modalList.appendChild(empty);
        } else {
            list.forEach((person, index) => {
                const item = document.createElement("div");

                item.className = "guest-item";

                item.innerHTML = `
                    <span class="guest-number">${index + 1}</span>
                    <span class="guest-name">${escapeHtml(person.name)}</span>
                `;

                modalList.appendChild(item);
            });
        }

        listModal.classList.add("show");
        document.body.classList.add("modal-open");
    }

    function closeListModal() {
        if (!listModal) return;

        listModal.classList.remove("show");
        document.body.classList.remove("modal-open");
    }

    $$("[data-list]").forEach((button) => {
        button.addEventListener("click", () => {
            const type = button.dataset.list;

            openListModal(type);
        });
    });

    modalCloseButtons.forEach((button) => {
        button.addEventListener("click", closeListModal);
    });

    if (listModal) {
        listModal.addEventListener("click", (event) => {
            if (event.target === listModal) {
                closeListModal();
            }
        });
    }

    document.addEventListener("keydown", (event) => {
        if (event.key === "Escape") {
            closeListModal();
        }
    });

    // ==========================================
    // WISHES
    // ==========================================

    const wishForm = $("#wishForm");
    const wishName = $("#wishName");
    const wishText = $("#wishText");
    const wishesList = $("#wishesList");
    const emptyWishes = $("#emptyWishes");

    function escapeHtml(value) {
        return String(value)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    function renderWishes() {
        if (!wishesList) return;

        const wishes = readStorage(WISHES_KEY);

        wishesList.innerHTML = "";

        if (!wishes.length) {
            if (emptyWishes) {
                emptyWishes.style.display = "block";
            }

            return;
        }

        if (emptyWishes) {
            emptyWishes.style.display = "none";
        }

        [...wishes]
            .reverse()
            .forEach((wish) => {
                const card = document.createElement("article");

                card.className = "wish-card";

                card.innerHTML = `
                    <div class="wish-card-top">
                        <div class="wish-avatar">
                            ${escapeHtml(
                                wish.name
                                    .charAt(0)
                                    .toUpperCase()
                            )}
                        </div>

                        <div>
                            <h4>${escapeHtml(wish.name)}</h4>
                            <span>Samimiy tilak</span>
                        </div>
                    </div>

                    <p>${escapeHtml(wish.text)}</p>
                `;

                wishesList.appendChild(card);
            });
    }

    if (wishForm) {
        wishForm.addEventListener("submit", (event) => {
            event.preventDefault();

            const name = wishName
                ? normalizeName(wishName.value)
                : "";

            const text = wishText
                ? wishText.value.trim()
                : "";

            if (!name) {
                showToast("Iltimos, ismingizni kiriting.");
                return;
            }

            if (!text) {
                showToast("Iltimos, tilagingizni yozing.");
                return;
            }

            const wishes = readStorage(WISHES_KEY);

            wishes.push({
                name: name,
                text: text,
                time: new Date().toISOString()
            });

            writeStorage(WISHES_KEY, wishes);

            if (wishName) {
                wishName.value = "";
            }

            if (wishText) {
                wishText.value = "";
            }

            renderWishes();

            showToast(
                "Samimiy tilagingiz uchun rahmat! ❤️"
            );
        });
    }

    renderWishes();

    // ==========================================
    // SCROLL REVEAL
    // ==========================================

    const revealElements = $$(
        ".reveal, .event-card, .gallery-section, .rsvp-section, .wishes-section"
    );

    if ("IntersectionObserver" in window) {
        const observer = new IntersectionObserver(
            (entries) => {
                entries.forEach((entry) => {
                    if (entry.isIntersecting) {
                        entry.target.classList.add("visible");
                        observer.unobserve(entry.target);
                    }
                });
            },
            {
                threshold: 0.1
            }
        );

        revealElements.forEach((element) => {
            observer.observe(element);
        });
    } else {
        revealElements.forEach((element) => {
            element.classList.add("visible");
        });
    }

    // ==========================================
    // PAGE LOADED
    // ==========================================

    console.log(
        "Dadajon & Odina — Fotiha Dasturxoni taklifnomasi ishga tushdi."
    );
});