# RO Digital Twin ML Guidelines

1. **Architecture Sizing**: Do not use a Transformer instead of the LSTM. Transformers need large datasets (10,000+ samples minimum). With limited real data (e.g. 177 rows), an LSTM is the correct architecture. Transformers will overfit catastrophically.
2. **Parameter Tuning**: Do not increase LSTM layers or hidden size until you have at least 2,000 rows of real data. More parameters on small data equals overfitting, not smarter predictions. (Keep hidden size ~16, layers ~1).
3. **Anomaly Detection**: Do not use an autoencoder for anomaly detection until the baseline physics models are correct — you cannot detect anomalies against a baseline that itself contains errors. Use static/physics baselines instead.
4. **Finance / Tabular ML**: Do not replace scikit-learn with TensorFlow or a larger framework for Model 3 (OPEX/Finance). XGBoost is faster, more accurate on tabular data, and far less complex to maintain.
