# SMS+ IAM Setup

## What you need before you start:

* **Your SMS+ tenant info:** This includes your tenant location and hook URL (it'll look something like [`https://yourdomain/hooks/okta`](https://yourdomain/hooks/okta)). You'll also get a secret or combo for each hook. (Note that you can have multiple hooks, but you probably won't need 'em unless you're using a bunch of different IAMs in parallel.)

* **SMS OTP enabled in your IAM:** This needs to be an option in your authentication policies, MFA, or passwordless setup. You can set it up later, but it's a must to use SMS+.

* **An SMS provider:** Make sure you've got one set up in your SMS+ tenant.

## Setting up your IAM:

Each IAM has its own steps, so check out yours below:

* ### Okta:

  * Log in as an admin.  
  * Go to **Workflow \> Inline Hooks \> Add Inline Hook** (make sure it's for Telephony/SMS).  
  * Name it "TypingDNA SMS+".  
  * For the URL, use your specific Okta hook URL from TypingDNA (e.g., [`https://yourdomain/hooks/okta`](https://yourdomain/hooks/okta)).  
  * For authentication, choose "HTTP Headers," set the field to "Authorization," and the secret to "Bearer " \+ your `OKTA_SHARED_SECRET`  
    * define **OKTA\_SHARED\_SECRET** yourself, also set in your SMS+ env

* ### Auth0:

  * Log in as an admin.  
  * Go to **Branding \> Phone Provider \> Custom** (for Text/SMS only).  
  * Add a secret called `TDN_SECRET` \= `AUTH0_SECRET`  
  * define **AUTH0\_SECRET** yourself, also set in your SMS+ env  
  * Paste the following Node code into the "Provider Configuration" and then save/deploy it.  
    ```
    exports.onExecuteCustomPhoneProvider = async (event, api) => { 
        if (!event.notification.message_type.startsWith('otp')) return; 
        const response = await fetch('https://yourdomain/hooks/cybersolve-auth0-sms', {
            method: 'POST', 
            headers: { 
                'Content-Type': 'application/json', 
                'Authorization': 'Bearer ${event.secrets.TDN_SECRET}'  
            },  
            body: JSON.stringify({ 
                recipient: event.notification.recipient, 
                message:      event.notification.as_text,
                code:      event.notification.code
            })
        }); 
        if (!response.ok) {
            console.log(`Bridge error ${response.status}: ${await response.text()}`);
            throw new Error('TypingDNA bridge failed');
        }
    };
    ```

* ### PingOne:

  * Heads up: you'll need a premium license with PingOne MFA service.  
  * Log into your PingOne admin and choose your environment  
  * Go to **Settings \> Senders \> \[+\] \> Add Provider**  
    * Sender Type: **SMS/Voice**  
    * Provider Type: **Custom Provider**  
  * Provider configuration:  
    * Name it "TypingDNA SMS PLUS".  
    * Authorization: Basic  
    * Use the following credentials:  
      * User: “**pingone”**  
      * Pass: **PING\_SHARED\_SECRET** (define it yourself, also set in your SMS+ env)  
    * Check SMS only (not Voice)  
  * SMS configuration:  
    * Type: **POST**  
    * URL: user your PingOne hook URL from TypingDNA (e.g [`https://yourdomain/hooks/pingone`](https://yourdomain/hooks/pingone) )  
    * Body: **Raw**  
    * Raw: **{ "recipient": "${to}", "body": "${message}" }**  
    * Headers: Key:content-type, Value:application/json  
    * Plus Sign: Enable  
  * You can now click Send Test SMS  
  * To enable SMS to work as an MFA factor (if not yet enabled) go to **Authentication \> MFA Policies** and add/edit a policy with SMS method enabled.

* ### CyberArk:

  * Log into your CyberArk Identity Administration.  
  * Head to **Settings \> Customization \> Account/System Configuration \> SMS Gateway Settings \> Add SMS Gateway**.  
  * Name it "TypingDNA SMS+".  
  * For the URL, use your CyberArk hook URL from TypingDNA (e.g., [`https://yourdomain/hooks/cyberark`](https://yourdomain/hooks/cyberark)).  
  * In "Parameters," make sure authentication has "username:password" and fill in the username and password:  
    * Username: “**cyberark”**  
    * Password: **CYBERARK\_PASS** (define it yourself, also set in your SMS+ env)  
  * You can test the connection with a simple payload like   
    `{"phoneNumber":"your-number","smsMessage":"123456"}`.  
  * Don't forget to go to the "Assignment" tab and add the groups/users/roles who will use this SMS Gateway.

* ### FusionAuth:

  * Heads up: you'll need a premium license for this (SMS option will not work otherwise).  
  * Log into your FusionAuth tenant admin.  
  * Go to **Settings \> Messengers \> Add Generic Messenger**.  
  * Name it "TypingDNA SMS+".  
  * For the URL, use your FusionAuth hook URL from TypingDNA (e.g., [`https://yourdomain/hooks/fusionauth`](https://yourdomain/hooks/fusionauth)).  
  * Set the "Timeout params" to 2000+ ms (or keep your current values if you're happy).  
  * Under "Security," add your Basic auth credentials:  
    * User: “**fusionauth”**  
    * Pass: **FUSIONAUTH\_PASS** (define it yourself, also set in your SMS+ env)  
  * Leave everything else blank.  
  * You can now test the generic configuration.

  ### 

