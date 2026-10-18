"""Research-only solver. No private identifiers or raw source text enter this process.
C=1/lambda for sklearn's summed binomial loss + lambda/2 * ||coef||^2;
lbfgs leaves the intercept unpenalized. No normalization/preprocessing is fitted.
"""
import json, sys, warnings
import numpy as np
import sklearn
from threadpoolctl import threadpool_limits
from sklearn.linear_model import LogisticRegression
from sklearn.exceptions import ConvergenceWarning
from sklearn.metrics import log_loss, brier_score_loss

def main(data):
    p = data['plan']
    if sklearn.__version__ != p['solverVersion'] or p['purpose'] != 'synthetic_software_test':
        raise ValueError('solver version or purpose mismatch')
    splits = {name: (np.asarray(v['x'], dtype=float), np.asarray(v['y'], dtype=int)) for name, v in data['split'].items()}
    tx, ty = splits['train']; vx, vy = splits['validation']; hx, hy = splits['test']
    baseline = float(np.mean(ty))
    def metrics(y, scores):
        if not np.isfinite(scores).all(): raise ValueError('non-finite prediction')
        return {'log_loss': float(log_loss(y, scores, labels=[0,1])), 'brier': float(brier_score_loss(y, scores))}
    baseline_v = metrics(vy, np.full(len(vy), baseline))
    baseline_h = metrics(hy, np.full(len(hy), baseline))
    candidates = []; models = []
    columns = p['candidateCatalog'] + ['and:' + '&'.join(p['candidateCatalog'])]
    for name, width in [('main_effects', 2), ('with_and', 3)]:
        for lam in p['regularizationCandidates']:
            with warnings.catch_warnings():
                warnings.simplefilter('error', ConvergenceWarning)
                model = LogisticRegression(C=1.0/lam, solver='lbfgs', penalty='l2', tol=p['tolerance'], max_iter=p['maxIterations'], fit_intercept=True)
                model.fit(tx[:,:width], ty)
            if not np.isfinite(model.coef_).all() or not np.isfinite(model.intercept_).all(): raise ValueError('nonfinite model')
            params = {'name': name, 'columns': columns[:width], 'lambda': lam, 'intercept': float(model.intercept_[0]), 'coefficients': model.coef_[0].tolist(), 'iterations': int(model.n_iter_[0])}
            candidates.append({'model': params, 'validation': metrics(vy, model.predict_proba(vx[:,:width])[:,1])})
            models.append((model,width))
    # Test data is used only once, after validation chooses one frozen candidate.
    chosen = min(range(len(candidates)), key=lambda i: (candidates[i]['validation']['log_loss'], i))
    candidate = candidates[chosen]; model,width = models[chosen]
    test_metrics = metrics(hy,model.predict_proba(hx[:,:width])[:,1])
    improved = (candidate['validation']['log_loss'] + p['minimumImprovement'] < baseline_v['log_loss'] and test_metrics['log_loss'] + p['minimumImprovement'] < baseline_h['log_loss'] and candidate['validation']['brier'] <= baseline_v['brier'] and test_metrics['brier'] <= baseline_h['brier'])
    return {'solver': 'sklearn.LogisticRegression', 'version': sklearn.__version__, 'objective': 'sum_log_loss_plus_lambda_half_l2', 'interceptPenalized': False,
            'baseline': {'validation':baseline_v,'test':baseline_h},'candidates':candidates,'selectedTest':test_metrics,
            'selected':candidate['model'] if improved else None, 'uncertainty': 'not_estimated_synthetic_only',
            'parityInputs':hx[:8,:width].tolist(),'parityScores':model.predict_proba(hx[:8,:width])[:,1].tolist()}
if __name__ == '__main__':
    try:
        with threadpool_limits(limits=1):
            print(json.dumps(main(json.load(sys.stdin)),allow_nan=False))
    except Exception: sys.exit(2)
