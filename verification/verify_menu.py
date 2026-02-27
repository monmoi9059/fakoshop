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

    # --- Test Menu Interaction ---
    # Click File Menu
    page.click("div.menu-item:has-text('File')")

    # Check if dropdown is visible
    expect_new_btn = page.locator("#file-menu div:has-text('New')")
    if expect_new_btn.is_visible():
        print("File menu opened successfully.")
    else:
        print("File menu failed to open.")

    # Click Filter Menu
    page.click("div.menu-item:has-text('Filter')")

    # Check if Blur is visible
    expect_blur = page.locator("#filter-menu div:has-text('Blur')")
    if expect_blur.is_visible():
        print("Filter menu opened successfully.")
    else:
        print("Filter menu failed to open.")

    browser.close()

with sync_playwright() as playwright:
    run(playwright)
