function verify() {
    const {
        pleaseAcceptTheTermsToContinue,
        pleaseTypeTheTextAbove,
        tooManyTyposPleaseTypeAgain,
        failed,
        failedToFetch,
        secureCodesEnabled,
    } = translationsObj || {};

    // ─── gate: must accept Terms and Conditions on first enrollment ───────────────
    if (enrollingBool && !termsConditionsCheck.checked) {
        alert(pleaseAcceptTheTermsToContinue);
        return; // stop submission
    }

    const text = inputTyping.value.trim();
    if (!text) {
        alert(pleaseTypeTheTextAbove);
        return;
    }
    if (countTypos(text, TDNA_TEXT) > 2) {
        alert(tooManyTyposPleaseTypeAgain);
        resetTyping();
        return;
    }

    preloader.classList.add('active');
    verifyBtn.disabled = true;

    const tp = tdna.getTypingPattern({ type: 2, text: TDNA_TEXT });
    const textId = tdna.getTextId(TDNA_TEXT);

    fetch('/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tp, cid: CHALLENGE_ID, textId }),
    })
        .then(async (res) => {
            const json = await res.json();

            if (res.status === 403) {
                // Too many failed attempts - status locked
                handleElementVisibility('resetLink', 'show', '');
                handleElementVisibility('refreshMessage', 'hide', '');
            } else if (json.result === 0) {
                // Failed typing pattern
                handleElementVisibility('resetLink', 'hide');
                handleElementVisibility('refreshMessage', 'show');
            }

            return json;
        })
        .then((json) => {
            preloader.classList.remove('active');
            resetTyping();

            // incorrectPositionTryAgain => display challenge section again
            if (json.code === 109) {
                // replace typing info description with new message
                const typingInfoDescElement = document.getElementById('typingInfoDescription');
                if(typingInfoDescElement) typingInfoDescElement.innerHTML = json.message;

                // display showStage:challenge after motion data is detected
                showMotionAlert(true);
                return;
            }

            // incorrectPosition => display posture image & final message to start again
            if (json.code === 108) {
                showStage('result');

                handleElementVisibility('resultStatus', 'show', `ℹ️ <span class="text-secondary">Error</span>`);
                // display again the image for clarity
                handleElementVisibility('resultMessage', 'show', ` <div class="posture-container mb-3">
                        <img src="/static/holdingphone.png" alt="phone posture" />
                    </div>
                    <span>${json.message}</span>`);
                handleElementVisibility('resultOTP', 'hide');

                return;
            }

            showStage('result');

            let statusHtml;
            if (json.result === 1) {
                statusHtml = '';
            } else if (json.result === 0) {
                statusHtml = `❌ <span class="text-danger">${failed}</span>`;
            } else if (json.action === 'enroll') {
                statusHtml = '';
            } else {
                statusHtml = `ℹ️ <span class="text-secondary">${json.title || 'Error'}</span><br /><span style="font-size: 1rem">${json.message}</span>`;
            }

            handleElementVisibility('resultStatus', 'show', statusHtml);

            if (json.otp) {
                if (json.disableTid) {
                    window.DISABLE_TID = json.disableTid;

                    handleElementVisibility('disableLink', 'show');
                }
                const otpSpanDiv = document.getElementById('otpValue');
                if(otpSpanDiv) {
                    otpSpanDiv.innerHTML = json.otp;
                }

                handleElementVisibility('resultOTP', 'show');
            }

            if (json.action == 'enroll' && enrollingBool) {
                handleElementVisibility('resultMessage', 'show', `${secureCodesEnabled}`);
            } else {
                handleElementVisibility('resultMessage', 'hide');
            }

            if(json.resetNowTid) {
                window.RESET_NOW_TID = json.resetNowTid;
                showResetAccountNowModal();
            }
        })
        .catch((err) => {
            preloader.classList.remove('active');

            handleElementVisibility('resultStatus', 'show', `<span class="text-danger">❌ ${failedToFetch}</span>`);
            handleElementVisibility('resultOTP', 'hide');
            handleElementVisibility('resultMessage', 'hide');

            showStage('result');
        });
}

/****************************************
 * Motion detection & motion alertmethods
 ****************************************/
function checkMotionPermission() {
    const hasIOSMotionCapabilities =
        deviceType === 'ios' && typeof DeviceMotionEvent?.requestPermission === 'function';
    const alreadyGranted = sessionStorage.getItem(motionGrantedFlag) === 'true';

    if (hasIOSMotionCapabilities) {
        if (alreadyGranted) {
            // You MUST still call requestPermission() on each new page
            requestMotionPermission();
        } else {
            // First-time load: show prompt link
            showMotionAlert(false);
        }
    } else if ('DeviceMotionEvent' in window) {
        let motionDetected = false;

        const motionHandler = (e) => {
            if (e.acceleration?.x || e.acceleration?.y || e.acceleration?.z) {
                motionDetected = true;
                enableTyping();
                window.removeEventListener('devicemotion', motionHandler);
            }
        };
        window.addEventListener('devicemotion', motionHandler);

        setTimeout(() => {
            window.removeEventListener('devicemotion', motionHandler);
            if (!motionDetected) showMotionAlert(true);
        }, 1500);
    } else {
        showMotionAlert(true);
    }
}

async function requestMotionPermission() {
    try {
        const p = await DeviceMotionEvent.requestPermission();

        if (p === 'granted') enableTyping();
        else showMotionAlert(true);
    } catch (err) {
        showMotionAlert(true);
    }
}

function startAlertMotionDetection() {
    const handler = (e) => {
        if (e.acceleration?.x || e.acceleration?.y || e.acceleration?.z) {
            enableTyping();
            window.removeEventListener('devicemotion', handler);
            clearTimeout(alertMotionTimeoutId);
        }
    };

    window.addEventListener('devicemotion', handler);
    alertMotionHandler = handler;
    alertMotionTimeoutId = setTimeout(() => {
        window.removeEventListener('devicemotion', handler);
    }, 10000);
}

/**
 * Displays a motion alert to the user when
 * motion sensors are required but not available.
 * @param {boolean} permanent
 *      - If true, shows a permanent alert that requires user action to dismiss.
 *      - If false, shows a temporary alert that auto-dismisses when motion is detected.
 */
function showMotionAlert(permanent) {
    motionAlert.classList.add('active');
    challengeBlock.style.visibility = 'hidden';
    inputTyping.disabled = true;
    verifyBtn.disabled = true;

    const { motionAlertIos, motionAlertAndroid, motionAlertDeviceNotSupported } =
        translationsObj || {};

    if (permanent) {
        if (deviceType === 'ios') {
            motionAlert.innerHTML = motionAlertIos;
        } else if (deviceType === 'android') {
            motionAlert.innerHTML = motionAlertAndroid;
        } else {
            motionAlert.innerHTML = motionAlertDeviceNotSupported;
        }
    }

    startAlertMotionDetection();
}

function hideMotionAlert() {
    motionAlert.classList.remove('active');
    challengeBlock.style.visibility = 'visible';
    if (alertMotionHandler) {
        window.removeEventListener('devicemotion', alertMotionHandler);
        alertMotionHandler = null;
        clearTimeout(alertMotionTimeoutId);
    }
}

function detectDeviceType() {
    const ua = navigator.userAgent || navigator.vendor || window.opera;

    if (/android/i.test(ua)) return 'android';
    if (/iPad|iPhone|iPod/.test(ua) && !window.MSStream) return 'ios';
    return 'desktop';
}

/****************************************
 * Reset methods
 ****************************************/
function showResetScreen() {
    // Hide result stage
    resultBlock.classList.replace('visible', 'hidden-next');
    // Show reset stage
    document.getElementById('resetStage').classList.replace('hidden-next', 'visible');
}

function submitReset() {
    const { phoneNumberInternationalFormat, resetFailed, resetRequested, helpError } =
        translationsObj || {};

    const phone = document.getElementById('resetPhone').value.trim();
    if (!phone.match(/^\+\d{6,15}$/)) {
        alert(phoneNumberInternationalFormat);
        return;
    }

    fetch('/reset-account', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cid: CHALLENGE_ID, phone }),
    })
        .then(async (res) => {
            const json = await res.json();
            if (!res.ok) {
                alert(json.message || resetFailed);
                return;
            }

            // display success message
            let msg = json.message || resetRequested;
            if (json.translationKey) {
                msg = translationsObj[json.translationKey];
            }

            handleElementVisibility('resetLink', 'hide');
            handleElementVisibility('resultStatus', 'hide');
            handleElementVisibility('resultMessage', 'show', `ℹ️ <span class="text-secondary">${msg}</span>`);

            resetStage.classList.replace('visible', 'hidden-next');
            resultBlock.classList.replace('hidden-next', 'visible');
        })
        .catch((err) => {
            alert(`${helpError}: ${err.message}`);
        });
}

/****************************************
 * Disable token methods
 ****************************************/
function showDisableStage() {
    // hide result, show disable form
    resultBlock.classList.replace('visible', 'hidden-next');
    document.getElementById('disableStage').classList.replace('hidden-next', 'visible');
}

function submitDisable() {
    const {
        phoneNumberInternationalFormat,
        sessionExpired,
        confirmSecureCodesDisable,
        secureCodesDisabled,
        disableFailed,
    } = translationsObj || {};

    const phone = document.getElementById('disablePhone').value.trim();
    if (!phone.match(/^\+\d{6,15}$/)) {
        alert(phoneNumberInternationalFormat);
        return;
    }
    if (!window.DISABLE_TID) {
        // shouldn’t happen
        alert(sessionExpired);
        return;
    }
    if (!confirm(confirmSecureCodesDisable)) return;

    preloader.classList.add('active');

    fetch('/disable-account', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            phone: phone,
            disableTid: window.DISABLE_TID,
        }),
    })
        .then(async (r) => {
            const j = await r.json();

            preloader.classList.remove('active');

            if (!r.ok) throw new Error(j.message || disableFailed);

            if (j.translationKey) {
                alert(translationsObj[j.translationKey]);
            } else {
                alert(j.message || secureCodesDisabled);
            }

            setTimeout(() => {
                window.location.href = 'about:blank';
            }, 200);
        })
        .catch((err) => {
            preloader.classList.remove('active');
            alert(err.message);
        });
}

/****************************************
 * Show/ hide methods
 ****************************************/
function showStage(which) {
    if (which === 'challenge') {
        challengeContainer.classList.replace('hidden-prev', 'visible');
        resultBlock.classList.replace('visible', 'hidden-next');
        animateItems(challengeContainer);
        if (closeBtn) closeBtn.style.display = 'none';
    } else {
        challengeContainer.classList.replace('visible', 'hidden-prev');
        resultBlock.classList.replace('hidden-next', 'visible');
        animateItems(resultBlock);
        if (closeBtn) closeBtn.style.display = 'block';
    }
}

/**
 * @param {string} visibility - 'show' or 'hide'
 * @param {string} message - message to display (optional)
 */
function handleElementVisibility(identifier, visibility, message) {
    if(!identifier) return;

    const element = document.getElementById(identifier);
    if(!element) return;

    if(message) element.innerHTML = message;

    if(visibility === 'show') element.style.display = 'block';
    else if(visibility === 'hide') element.style.display = 'none';
}

// Enable button only when typing is ready *and* (checkbox ticked or not shown)
function updateButtonState() {
    const typingReady = !inputTyping.disabled; // or your own flag
    const tosReady = !enrollingBool || termsConditionsCheck.checked;
    verifyBtn.disabled = !(typingReady && tosReady);
}

function enableTyping() {
    sessionStorage.setItem(motionGrantedFlag, 'true');
    hideMotionAlert();
    inputTyping.disabled = false;
    updateButtonState();
    //verifyBtn.disabled = false;
}

/****************************************
 * Helper methods
 ****************************************/
function copyOtpCode() {
    const code = document.getElementById('otpValue')?.textContent.trim();
    const btn = document.getElementById('copyOtpBtn');
    const icon = document.getElementById('copyIcon');

    if (code) {
        navigator.clipboard
            ?.writeText(code)
            .then(() => {
                icon.style.stroke = '#27ae60'; // green
                btn.title = 'Copied!';
                setTimeout(() => {
                    icon.style.stroke = ''; // reset
                    btn.title = translationsObj.copyCode;
                }, 1000);
            })
            .catch(() => {
                btn.title = translationsObj.copyCodeFailed;
                setTimeout(() => {
                    btn.title = translationsObj.copyCode;
                }, 1200);
            });
    }
}

function closeWindow() {
    window.close();
    setTimeout(() => {
        window.location.href = 'about:blank';
    }, 200);
}

function animateItems(scope) {
    const items = [...scope.querySelectorAll('.anim')];
    items.forEach((el) => {
        el.classList.remove('show');
        el.style.transitionDelay = '0ms';
    });
    requestAnimationFrame(() => {
        items.forEach((el, i) => {
            const extra = el.classList.contains('delay-extra') ? 120 : 0;
            el.style.transitionDelay = `${i * 120 + extra}ms`;
            el.classList.add('show');
        });
    });
}

function resetTyping() {
    tdna.reset();
    inputTyping.value = '';
}
function countTypos(a, b) {
    a = a.toLowerCase();
    b = b.toLowerCase();
    const max = Math.max(a.length, b.length);
    let diff = 0;
    for (let i = 0; i < max; i++) if (a[i] !== b[i]) diff++;
    return diff;
}

/****************************************
 * Reset Account Now Modal methods
 ****************************************/
function showResetAccountNowModal() {
    const modal = document.getElementById('resetAccountNowModal');
    if (modal) {
        modal.classList.add('active');
        // Reset to initial view
        document.getElementById('resetAccountNowInitialView').style.display = 'block';
        document.getElementById('resetAccountNowPhoneView').style.display = 'none';
        document.getElementById('resetAccountNowResponseView').style.display = 'none';
        document.getElementById('resetAccountNowPhone').value = '';
        // Hide loader
        const loader = document.getElementById('resetAccountNowLoader');
        if (loader) {
            loader.classList.remove('active');
        }
    }
}

function closeResetAccountNowModal() {
    const modal = document.getElementById('resetAccountNowModal');
    if (modal) {
        modal.classList.remove('active');
    }
}

function showResetAccountNowPhoneInput() {
    document.getElementById('resetAccountNowInitialView').style.display = 'none';
    document.getElementById('resetAccountNowPhoneView').style.display = 'block';
}

function submitResetAccountNow() {
    const { phoneNumberInternationalFormat, helpError } =
        translationsObj || {};

    const phone = document.getElementById('resetAccountNowPhone').value.trim();
    if (!phone.match(/^\+\d{6,15}$/)) {
        alert(phoneNumberInternationalFormat);
        return;
    }

    const loader = document.getElementById('resetAccountNowLoader');
    if (loader) {
        loader.classList.add('active');
    }

    fetch('/reset-account-now', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cid: RESET_NOW_TID, phoneNumber: phone }),
    })
        .then(async (res) => {
            const json = await res.json();
            if (loader) {
                loader.classList.remove('active');
            }

            // Hide phone input view
            document.getElementById('resetAccountNowPhoneView').style.display = 'none';

            // Get the message to display
            let message = helpError;
            if (json.translationKey && translationsObj[json.translationKey]) {
                message = translationsObj[json.translationKey];
            } else if (json.message) {
                message = json.message;
            }

            // Show response view with message
            const responseMessage = document.getElementById('resetAccountNowResponseMessage');
            if (responseMessage) {
                responseMessage.innerHTML = message;
            }
            document.getElementById('resetAccountNowResponseView').style.display = 'block';
        })
        .catch((err) => {
            if (loader) {
                loader.classList.remove('active');
            }

            // Hide phone input view
            document.getElementById('resetAccountNowPhoneView').style.display = 'none';

            // Show error message in response view
            const responseMessage = document.getElementById('resetAccountNowResponseMessage');
            if (responseMessage) {
                responseMessage.innerHTML = `${helpError}: ${err.message}`;
            }
            document.getElementById('resetAccountNowResponseView').style.display = 'block';
        });
}

/****************************************
 * DOM Loaded
 ****************************************/
window.addEventListener('DOMContentLoaded', () => {
    window.scrollTo(0, 0);

    // ─── show checkbox only for enrolling users ────────────────
    if (enrollingBool) {
        termsConditionsBlock.style.display = 'block'; // un-hide
        termsConditionsCheck.addEventListener('change', updateButtonState);
    }

    // Run once so the button reflects the initial state
    updateButtonState();

    animateItems(challengeContainer);

    checkMotionPermission();
});
