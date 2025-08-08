(function () {
    'use strict';

    // DOM cache for better performance
    const $ = document.querySelector.bind(document);
    const $$ = (selector) => Array.from(document.querySelectorAll(selector));

    // Device and browser capability detection (simplified)
    const client = {
        mobile: /android|ios|iphone|ipad|mobile/i.test(navigator.userAgent.toLowerCase()),
        supportsViewportUnits: CSS.supports("height", "100dvh"),
        prefersReducedMotion: window.matchMedia('(prefers-reduced-motion: reduce)').matches
    };

    // Mobile viewport height adjustments
    if (client.mobile) {
        const setVH = () => {
            const height = client.supportsViewportUnits ? "100svh" : `${window.innerHeight}px`;
            document.documentElement.style.setProperty('--viewport-height', height);
        };

        if (!client.supportsViewportUnits) {
            window.addEventListener("resize", setVH, { passive: true });
            window.addEventListener("orientationchange", () => setTimeout(setVH, 100), { passive: true });
        }

        window.addEventListener("load", setVH, { passive: true });
        document.body.classList.add("is-touch");
    }

    /**
     * Clipboard Dialog Component
     * Simplified and optimized for performance
     */
    class ClipboardDialog {
        constructor() {
            // Initialize elements
            this.$dialog = $('#clipboard-dialog');
            this.$wrapper = this.$dialog.querySelector('.wrapper');
            this.$content = this.$dialog.querySelector('.content');
            this.$closeBtn = this.$dialog.querySelector('.close');
            this.isAnimating = false;
            
            // Setup event listeners
            this.setupEvents();
        }

        setupEvents() {
            // Close dialog events
            this.$closeBtn.addEventListener("click", () => this.close());
            this.$dialog.addEventListener("click", e => {
                if (e.target === this.$dialog) this.close();
            });
            
            // Keyboard accessibility
            this.$dialog.addEventListener("keydown", e => {
                if (e.key === "Escape") this.close();
            });

            // Copy content on click
            this.$wrapper.addEventListener("click", e => {
                e.stopPropagation();
                this.copyContent();
            });
            
            // Handle button clicks using event delegation
            document.addEventListener('click', e => {
                const btn = e.target.closest('#ml-btn, #ds-btn, #ya-btn');
                if (!btn) return;
                
                e.preventDefault();
                const content = btn.dataset.content;
                if (content) this.open(content);
            });
        }

        async copyContent() {
            try {
                if (navigator.clipboard) {
                    await navigator.clipboard.writeText(this.$content.textContent);
                    this.$wrapper.classList.add("copied");
                    setTimeout(() => this.close(), 800);
                } else {
                    this.fallbackCopy();
                }
            } catch (err) {
                console.warn('Clipboard API failed, using fallback');
                this.fallbackCopy();
            }
        }

        fallbackCopy() {
            try {
                const selection = window.getSelection();
                const range = document.createRange();
                range.selectNodeContents(this.$content);
                selection.removeAllRanges();
                selection.addRange(range);
                document.execCommand('copy');
                selection.removeAllRanges();
                
                this.$wrapper.classList.add("copied");
                setTimeout(() => this.close(), 800);
            } catch (err) {
                console.error('Copy failed');
                this.close();
            }
        }

        close() {
            if (this.isAnimating) return;
            
            this.isAnimating = true;
            this.$dialog.classList.remove("active");
            
            setTimeout(() => {
                this.$dialog.close();
                this.$wrapper.classList.remove("copied");
                this.isAnimating = false;
            }, 200);
        }

        open(content) {
            if (this.isAnimating) return;
            
            this.isAnimating = true;
            this.$content.textContent = content;
            this.$dialog.showModal();
            
            // Use requestAnimationFrame for smoother animation
            requestAnimationFrame(() => {
                this.$dialog.classList.add("active");
                setTimeout(() => this.isAnimating = false, 300);
            });
        }
    }

    // Initialize dialog
    new ClipboardDialog();
    
    // Add keyboard accessibility to social buttons
    $$('.social-button').forEach(button => {
        button.addEventListener('keydown', e => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                button.click();
            }
        });
    });
})();
