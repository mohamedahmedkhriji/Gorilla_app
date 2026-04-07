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
    private var captureObserver: NSObjectProtocol?
    private lazy var blankingView: UIView = {
        let view = UIView(frame: .zero)
        view.backgroundColor = .black
        view.isHidden = true
        view.isUserInteractionEnabled = true
        view.autoresizingMask = [.flexibleWidth, .flexibleHeight]
        return view
    }()

    @objc override public func load() {
        captureObserver = NotificationCenter.default.addObserver(
            forName: UIScreen.capturedDidChangeNotification,
            object: nil,
            queue: .main
        ) { [weak self] _ in
            self?.updateBlankingState()
        }

        updateBlankingState()
    }

    deinit {
        if let captureObserver {
            NotificationCenter.default.removeObserver(captureObserver)
        }
    }

    @objc func setEnabled(_ call: CAPPluginCall) {
        protectionEnabled = call.getBool("enabled", false)
        updateBlankingState()
        call.resolve([
            "enabled": protectionEnabled
        ])
    }

    private func updateBlankingState() {
        DispatchQueue.main.async {
            let shouldBlank = self.protectionEnabled && UIScreen.main.isCaptured
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
