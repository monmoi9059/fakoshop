from playwright.sync_api import sync_playwright

def run(playwright):
    browser = playwright.chromium.launch(headless=True)
    context = browser.new_context()
    page = context.new_page()

    # Load the local HTML file
    import os
    file_path = f"file://{os.getcwd()}/index.html"
    page.goto(file_path)
    page.wait_for_selector("#main-canvas")

    # --- Test 1: Layer Independence ---
    # Draw on Layer 1 (Background)
    canvas = page.locator("#main-canvas")
    box = canvas.bounding_box()

    # Paint Blue on Layer 1
    page.fill("#primary-color", "#0000ff")
    page.evaluate("document.getElementById('primary-color').dispatchEvent(new Event('input'))")

    page.click("div[title='Rectangle (R)']")
    page.mouse.move(box["x"] + 10, box["y"] + 10)
    page.mouse.down()
    page.mouse.move(box["x"] + 50, box["y"] + 50)
    page.mouse.up()

    # Add Layer 2
    page.click("span[title='New Layer']")

    # Paint Red on Layer 2
    page.fill("#primary-color", "#ff0000")
    page.evaluate("document.getElementById('primary-color').dispatchEvent(new Event('input'))")

    page.mouse.move(box["x"] + 60, box["y"] + 60)
    page.mouse.down()
    page.mouse.move(box["x"] + 100, box["y"] + 100)
    page.mouse.up()

    # Hide Layer 2 (Red should disappear, Blue remains)
    # The eye icon is the first child of the active layer item (which is top of list now)
    page.locator(".layer-item.active .layer-eye").click()

    # Verify by screenshot (visual check)
    page.screenshot(path="verification/layer_test.png")

    # Delete Layer 2
    page.click("span[title='Delete Layer']")

    # Verify Layer 1 is active again
    layer_name = page.locator(".layer-item.active span:not(.layer-eye)").inner_text()
    if "Background" in layer_name:
        print("Layer deletion and activation logic worked.")
    else:
        print(f"Failed: Active layer is {layer_name}")

    browser.close()

with sync_playwright() as playwright:
    run(playwright)
