import XCTest
import SwiftUI
import UIKit
@testable import FateLab

@MainActor
final class TabNavigationTests: XCTestCase {
    func testReselectingTabResetsContentWithoutReplacingNavigationController() async throws {
        let router = AppTabRouter()
        let probe = TabContentProbe()
        let host = UIHostingController(rootView:
            ResettableTabStack(tab: .you) { TabContentFixture(probe: probe) }
                .environmentObject(router))
        let window = try present(host)
        defer { window.isHidden = true; window.rootViewController = nil }
        try await settle(host)
        let original = try XCTUnwrap(navigationController(in: host), "SwiftUI did not create its navigation controller")
        let originalContent = try XCTUnwrap(probe.identities.last)

        router.selectTab(.you)
        try await settle(host)

        let reset = try XCTUnwrap(navigationController(in: host))
        XCTAssertTrue(original === reset,
            "Reselecting a tab must retain the UINavigationController that owns its navigation bar")
        XCTAssertEqual(router.resetToken(for: .you), 1)
        XCTAssertNotEqual(try XCTUnwrap(probe.identities.last), originalContent,
            "Retaining the controller must still recreate the tab's root content")
    }

    func testDifferentTabsOwnDistinctControllersAndKeepThemWhenSwitching() async throws {
        let router = AppTabRouter()
        let firstProbe = TabContentProbe(), secondProbe = TabContentProbe()
        let host = UIHostingController(rootView:
            TabView(selection: Binding(get: { router.selectedTab }, set: { router.selectTab($0) })) {
                ResettableTabStack(tab: .you) { TabContentFixture(probe: firstProbe) }
                    .tabItem { Text("あなた") }.tag(AppTab.you)
                ResettableTabStack(tab: .couple) { TabContentFixture(probe: secondProbe) }
                    .tabItem { Text("ふたり") }.tag(AppTab.couple)
            }.environmentObject(router))
        let window = try present(host)
        defer { window.isHidden = true; window.rootViewController = nil }
        try await settle(host)
        let tabs = try XCTUnwrap(descendants(of: host).compactMap { $0 as? UITabBarController }.first)
        let firstRoot = try XCTUnwrap(tabs.viewControllers?.first)
        let first = try XCTUnwrap(navigationController(in: firstRoot))
        let firstContent = try XCTUnwrap(firstProbe.identities.last)

        router.selectTab(.couple)
        try await settle(host)
        let secondRoot = try XCTUnwrap(tabs.viewControllers?.last)
        let second = try XCTUnwrap(navigationController(in: secondRoot))
        XCTAssertFalse(first === second, "Each tab must own its own navigation bar/controller")
        XCTAssertEqual(tabs.selectedIndex, 1)

        router.selectTab(.you)
        try await settle(host)
        XCTAssertTrue(navigationController(in: firstRoot) === first)
        XCTAssertTrue(navigationController(in: secondRoot) === second)
        XCTAssertEqual(tabs.selectedIndex, 0)
        XCTAssertEqual(firstProbe.identities.last, firstContent,
            "Switching to another tab and back must preserve the first tab's content state")
        XCTAssertEqual(router.resetToken(for: .you), 0)
        XCTAssertEqual(router.resetToken(for: .couple), 0)
    }

    private func present(_ host: UIViewController) throws -> UIWindow {
        let scene = try XCTUnwrap(UIApplication.shared.connectedScenes.compactMap { $0 as? UIWindowScene }.first)
        let window = UIWindow(windowScene: scene)
        window.frame = scene.coordinateSpace.bounds
        window.rootViewController = host
        window.makeKeyAndVisible()
        return window
    }

    private func settle(_ host: UIViewController) async throws {
        // A bounded render wait, matching the existing hosting-controller tests.
        host.view.setNeedsLayout(); host.view.layoutIfNeeded()
        try await Task.sleep(for: .milliseconds(500))
        host.view.layoutIfNeeded()
    }

    private func descendants(of controller: UIViewController) -> [UIViewController] {
        controller.children.flatMap { [$0] + descendants(of: $0) }
    }

    private func navigationController(in controller: UIViewController) -> UINavigationController? {
        if let navigation = controller as? UINavigationController { return navigation }
        return descendants(of: controller).compactMap { $0 as? UINavigationController }.first
    }
}

@MainActor
private final class TabContentProbe {
    var identities: [UUID] = []
    func appeared(_ identity: UUID) {
        if identities.last != identity { identities.append(identity) }
    }
}

private struct TabContentFixture: View {
    let probe: TabContentProbe
    @State private var identity: UUID?
    var body: some View {
        VStack {
            Text("保存済み鑑定の合成ルート")
            NavigationLink("合成の詳細を開く") { Text("合成の詳細本文") }
        }
        .onAppear {
            // Generate after mounting. The same content value can be reused by
            // the host, so a UUID stored as its initial value cannot prove reset.
            let mountedIdentity = identity ?? UUID()
            identity = mountedIdentity
            probe.appeared(mountedIdentity)
        }
    }
}
