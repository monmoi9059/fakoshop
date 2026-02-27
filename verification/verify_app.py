from playwright.sync_api import sync_playwright

def run(playwright):
    browser = playwright.chromium.launch(headless=True)
    context = browser.new_context()
    page = context.new_page()

    # Load the local HTML file
    import os
    file_path = f"file://{os.getcwd()}/index.html"
    page.goto(file_path)

    # Wait for canvas to be present
    page.wait_for_selector("#main-canvas")

    # --- Test 1: Draw a Rectangle ---
    # Select Rectangle Tool
    page.click("div[title='Rectangle (R)']")

    # Draw on canvas
    canvas = page.locator("#main-canvas")
    box = canvas.bounding_box()

    # Draw a blue rectangle
    page.fill("#primary-color", "#0000ff")
    page.evaluate("document.getElementById('primary-color').dispatchEvent(new Event('input'))")

    page.mouse.move(box["x"] + 100, box["y"] + 100)
    page.mouse.down()
    page.mouse.move(box["x"] + 300, box["y"] + 250)
    page.mouse.up()

    # --- Test 2: Add a new Layer ---
    # Click New Layer button
    page.click("span[title='New Layer']")

    # Verify new layer appeared in list
    new_layer = page.locator(".layer-item").first
    print(f"Top layer text: {new_layer.inner_text()}")

    # --- Test 3: Draw a Circle on new layer ---
    # Select Circle Tool
    page.click("div[title='Circle (C)']")

    # Draw a red circle
    page.fill("#primary-color", "#ff0000")
    page.evaluate("document.getElementById('primary-color').dispatchEvent(new Event('input'))")

    page.mouse.move(box["x"] + 400, box["y"] + 100)
    page.mouse.down()
    page.mouse.move(box["x"] + 500, box["y"] + 200)
    page.mouse.up()

    # --- Test 4: Selection and Invert ---
    # Select Marquee Tool
    page.click("div[title='Marquee Select (M)']")

    # Select the circle area
    page.mouse.move(box["x"] + 350, box["y"] + 50)
    page.mouse.down()
    page.mouse.move(box["x"] + 550, box["y"] + 250)
    page.mouse.up()

    # Apply Invert Filter (should only affect the red circle)
    # We need to trigger the function directly or click a button if we had one for Invert.
    # In the UI, Invert is under Adjustments panel.
    page.click("button:has-text('Invert Colors')")

    # Take screenshot
    page.screenshot(path="verification/screenshot.png")

    browser.close()

with sync_playwright() as playwright:
    run(playwright)
