package activity

type ActivityDay struct {
	Date  string `json:"date"`
	Count int    `json:"count"`
}

type ActivityPeriodRequest struct {
	SpaceID   int    `json:"space_id"`
	Recursive    bool   `json:"recursive"`
	StartDate    string `json:"start_date"`
	EndDate      string `json:"end_date"`
	Period       int    `json:"period"`
	PeriodMonths int    `json:"period_months"`
}

type ActivityPeriodResponse struct {
	SpaceID int           `json:"space_id"`
	StartDate  string        `json:"start_date"`
	EndDate    string        `json:"end_date"`
	Period     int           `json:"period"`
	Days       []ActivityDay `json:"days"`
	Stats      PeriodStats   `json:"stats"`
	MaxPeriods int           `json:"max_periods"`
}

type PeriodStats struct {
	TotalPosts     int `json:"total_posts"`
	ActiveDays     int `json:"active_days"`
	MaxDayActivity int `json:"max_day_activity"`
}