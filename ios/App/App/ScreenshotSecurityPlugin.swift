import Foundation
import UIKit
import Capacitor

@objc(ScreenshotSecurityPlugin)
public class ScreenshotSecurityPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "ScreenshotSecurityPlugin"
    public let jsName = "ScreenshotSecurity"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "setEnabled", returnType: CAPPluginReturnPromise)
    ]

    private var protectionEnabled = false
    private var appIsActive = true
    private var observers: [NSObjectProtocol] = []
    private lazy var blankingView: UIView = {
        let view = UIView(frame: .zero)
        view.backgroundColor = .black
        view.isHidden = true
        view.isUserInteractionEnabled = true
        view.autoresizingMask = [.flexibleWidth, .flexibleHeight]
        return view
    }()

    @objc override public func load() {
        appIsActive = UIApplication.shared.applicationState == .active

        let notificationCenter = NotificationCenter.default
        let observedNotifications: [NSNotification.Name] = [
            UIScreen.capturedDidChangeNotification,
            UIApplication.willResignActiveNotification,
            UIApplication.didBecomeActiveNotification,
            UIApplication.didEnterBackgroundNotification,
            UIApplication.willEnterForegroundNotification,
        ]

        observers = observedNotifications.map { notificationName in
            notificationCenter.addObserver(
                forName: notificationName,
                object: nil,
                queue: .main
            ) { [weak self] notification in
                self?.handle(notification: notification)
            }
        }

        updateBlankingState()
    }

    deinit {
        observers.forEach { observer in
            NotificationCenter.default.removeObserver(observer)
        }
    }

    @objc func setEnabled(_ call: CAPPluginCall) {
        protectionEnabled = call.getBool("enabled", false)
        updateBlankingState()
        call.resolve([
            "enabled": protectionEnabled
        ])
    }

    private func handle(notification: Notification) {
        switch notification.name {
        case UIApplication.willResignActiveNotification, UIApplication.didEnterBackgroundNotification:
            appIsActive = false
        case UIApplication.didBecomeActiveNotification, UIApplication.willEnterForegroundNotification:
            appIsActive = true
        case UIScreen.capturedDidChangeNotification:
            break
        default:
            break
        }

        updateBlankingState()
    }

    private func updateBlankingState() {
        DispatchQueue.main.async {
            let shouldBlank = self.protectionEnabled && (!self.appIsActive || UIScreen.main.isCaptured)
            if shouldBlank {
                self.showBlankingView()
            } else {
                self.hideBlankingView()
            }
        }
    }

    private func showBlankingView() {
        guard let containerView = bridge?.viewController?.view else { return }

        if blankingView.superview !== containerView {
            blankingView.frame = containerView.bounds
            containerView.addSubview(blankingView)
        }

        containerView.bringSubviewToFront(blankingView)
        blankingView.isHidden = false
    }

    private func hideBlankingView() {
        blankingView.isHidden = true
        blankingView.removeFromSuperview()
    }
}
