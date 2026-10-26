## Home Assistant

**Configuration**

- In Home Assistant, navigate to your Profile page. This should be at the bottom left of the web interface, below the Notifications tab
- In the Home Assistant Profile page, scroll to the very bottom to find the **Long-Lived Access Tokens** section.
  ![Home Assistant Profile Page](images/ha-profile-page.png?raw=true 'Home Assistant Profile Page')
- Next, click "Create Token", give your token a name, and click "OK." Your access token should appear. Copy your token, then navigate to Companion.
- In Companion, navigate to the Home Assistant Server module settings and paste your Access Token. Then, input your Home Assistant URL. _Note: This URL should include the port, which is 8123 by default (ex. `http://192.168.1.10:8123` or `http://homeassistant.local:8123`)_

**Requirements**

Companion 5.1 or later. Floor and label targets and filters need Home Assistant 2024.4+, and returning service responses needs 2023.7+.

**Filtering entities**

Only entities that pass the filter are subscribed from Home Assistant, which keeps traffic and variables small on large installs. Filter by domain, name pattern, and by Home Assistant label, area and floor (include and exclude). The layers combine with AND. Tip: add a label such as `companion` in Home Assistant and include it here. Entities used by your buttons are always kept, even if the filter would drop them. With no filter set, everything is subscribed.

**Targets**

`Call Service` can target entities, areas, floors, labels or devices. Devices are loaded only while an action uses a device target.

**Action results**

Every action returns the service called and the entities affected. `Call Service` can return the service response (for example `weather.get_forecasts`) when `Return response` is ticked; store it in a custom variable using the action's result option.

**Available actions**

- Switch, input_boolean, group, fan: set on/off/toggle
- Light: on/off, brightness (set and adjust), colour (kelvin, RGB, hue/saturation; learnable)
- Script: execute. Button: press. Scene: activate
- Input Select and Select: first, last, next, previous, select option
- Cover: open, close, stop, set position, set tilt
- Valve: open, close, stop, set position
- Lock: lock, unlock, open
- Climate: HVAC mode, set and adjust target temperature (low/high in heat/cool range mode), preset
- Media player: play/pause, next, previous, set and adjust volume, mute, source
- Fan: speed (set and adjust), preset, oscillation
- Number and input_number: set and adjust value, clamped to min, max and step
- Call Service: any service, with targets and optional response

**Available feedbacks**

Boolean (change button style):

- Switch, input_boolean, light, binary sensor, group, fan on state
- Input select state
- Lock locked, lock jammed

Value (usable in expressions, text and as inputs to other features):

- Entity state or attribute value, and Compare entity state or attribute (equals, not equals, greater/less than, contains, regex)
- Light brightness (%), colour temperature (kelvin), colour (RGB number)
- Cover and valve position, cover tilt
- Climate current, target, and low/high target temperature
- Media player state and title
- Number value

Advanced:

- Button background from light colour

**Presets**

Template presets are provided for switch, input_boolean, light, script, button, scene, group, cover, valve, lock, fan, select, climate and media player, and include notes describing each.

**Available variables**

- Entity Value
- Entity Name
- Light Brightness
