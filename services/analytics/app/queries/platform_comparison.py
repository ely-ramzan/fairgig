PLATFORM_COMPARISON_QUERY = """
    WITH platform_stats AS (
        SELECT
            p.id AS platform_id,
            p.name AS platform_name,
            AVG(sl.platform_deductions / NULLIF(sl.gross_earned, 0)) * 100 AS avg_commission,
            AVG(sl.net_received / NULLIF(sl.hours_worked, 0)) AS avg_hourly,
            COUNT(DISTINCT sl.worker_id) AS worker_count
        FROM shift_logs sl
        JOIN platforms p ON sl.platform_id = p.id
        WHERE sl.shift_date >= NOW() - MAKE_INTERVAL(months => :months)
        GROUP BY p.id, p.name
    ),
    platform_complaints AS (
        SELECT
            platform_id,
            COUNT(*) AS complaint_count,
            COUNT(*) FILTER (WHERE category = 'deactivation') AS deactivation_count
        FROM grievances
        WHERE created_at >= NOW() - MAKE_INTERVAL(months => :months)
        GROUP BY platform_id
    )
    SELECT
        ps.platform_name,
        ROUND(ps.avg_commission, 2) AS avg_commission_rate,
        COALESCE(pc.complaint_count, 0) AS complaint_count,
        ROUND(ps.avg_hourly, 2) AS avg_hourly_rate,
        ps.worker_count,
        COALESCE(pc.deactivation_count, 0) AS deactivation_complaints,
        ROUND(
            (1.0 - LEAST(ps.avg_commission / 100.0, 1.0)) * 40 +
            GREATEST(0, 30 - COALESCE(pc.complaint_count, 0)) +
            LEAST(ps.avg_hourly / 20.0, 1.0) * 30
        , 1) AS fairness_score
    FROM platform_stats ps
    LEFT JOIN platform_complaints pc ON ps.platform_id = pc.platform_id
    ORDER BY fairness_score DESC
"""
