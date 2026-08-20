# NGA Camp 2027 Registration Status

Public, non-sensitive availability status for the NextGen Acting Summer Acting Camp 2027 webpage.

- Polls the public Jackrabbit registration page every five minutes.
- Tracks promotional class `22262489`, which has a maximum size of 10.
- Stores the highest observed registration count monotonically, so cancellations never reopen the website offer.
- Switches the published CTA to class `22204178` at the `$1,500` Super Early Bird rate after the first ten are claimed.
- Contains no student, family, payment, credential, or private Command Center data.

Status endpoint: `registration-status.json`
